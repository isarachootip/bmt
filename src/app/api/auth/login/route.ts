import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import {
  getSessionActor,
  SESSION_COOKIE_NAME,
  signSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { loginInputSchema, roleSwitchInputSchema } from '@/schemas/auth.schema';
import { ensureBootstrapped } from '@/services/bootstrap.service';

export async function GET(): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    const staff = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, email: true, fullName: true, role: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ actor, staff });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const body = (await request.json()) as Record<string, unknown>;

    const email =
      body.quickSwitch === true
        ? roleSwitchInputSchema.parse(body).email
        : loginInputSchema.parse(body).email;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'AUTH_FAILED', message: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' },
        { status: 401 },
      );
    }

    if (body.quickSwitch !== true) {
      const parsed = loginInputSchema.parse(body);
      if (!verifyPassword(parsed.password, user.passwordHash)) {
        return NextResponse.json(
          { error: 'AUTH_FAILED', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 },
        );
      }
    }

    const actor = {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
    };
    const token = signSessionCookie(actor);
    const response = NextResponse.json({ actor });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
