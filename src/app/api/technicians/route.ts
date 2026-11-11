import { NextResponse } from 'next/server';
import { createStatementToken } from '@/domain/security/statement-token';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDate } from '@/lib/timezone';
import { ensureBootstrapped } from '@/services/bootstrap.service';

export async function GET(): Promise<NextResponse> {
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

    const setting = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
    const techs = await prisma.technician.findMany({
      include: {
        jobPayments: {
          where: { stage2Status: { in: ['RETAINED', 'HOLD', 'DUE'] } },
          select: { stage2RemainingAmount: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
    });

    const { STATEMENT_SIGNING_SECRET } = getEnv();
    const items = techs.map((t) => ({
      id: t.id,
      code: t.code,
      fullName: t.fullName,
      status: t.status,
      depositStatus: t.depositStatus,
      depositBalance: Number(t.depositBalance),
      outstandingDebt: Number(t.outstandingDebt),
      supplierCode: t.supplierCode,
      bankAccountMask: t.bankAccountMask,
      taxIdMask: t.taxIdMask,
      intApprovedDate: formatBangkokDate(t.intApprovedAt),
      heldRetentionTotal: t.jobPayments.reduce(
        (sum, j) => sum + Number(j.stage2RemainingAmount),
        0,
      ),
      statementToken: createStatementToken(t.code, STATEMENT_SIGNING_SECRET),
    }));

    return NextResponse.json({
      requiredDeposit: Number(setting?.requiredDeposit ?? 10000),
      items,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
