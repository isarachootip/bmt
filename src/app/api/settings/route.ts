import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import type { UpdateSettingsInput } from '@/schemas/settings.schema';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { SettingsService } from '@/services/settings.service';

export async function GET(): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = assertRole(await getSessionActor(), [
      'PAYMENT_OFFICER',
      'APPROVER',
      'FINANCE_MANAGER',
      'ADMIN',
      'AUDITOR',
    ]);

    const service = new SettingsService(prisma);
    const data = await service.getSettings();
    return NextResponse.json({
      ...data,
      currentRole: actor.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = assertRole(await getSessionActor(), ['ADMIN']);

    const body = (await request.json()) as UpdateSettingsInput;
    const service = new SettingsService(prisma);
    const result = await service.updateSettings({ ...body, actor });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
