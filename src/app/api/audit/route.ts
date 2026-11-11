import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDateTime } from '@/lib/timezone';
import { AuditRepository } from '@/repositories/audit.repo';
import { ensureBootstrapped } from '@/services/bootstrap.service';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    assertRole(actor, [
      'PAYMENT_OFFICER',
      'APPROVER',
      'FINANCE_MANAGER',
      'ADMIN',
      'AUDITOR',
    ]);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? undefined;
    const repo = new AuditRepository(prisma);
    const logs = await repo.list({ query, limit: 300 });

    return NextResponse.json({
      items: logs.map((l) => ({
        id: l.id,
        timestamp: formatBangkokDateTime(l.createdAt),
        actorName: l.actorName,
        actorRole: l.actorRole,
        action: l.action,
        entityRef: l.entityRef,
        oldValue: l.oldValue,
        newValue: l.newValue,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
