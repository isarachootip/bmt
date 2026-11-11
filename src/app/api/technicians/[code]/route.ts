import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDateTime } from '@/lib/timezone';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { OffboardingService } from '@/services/offboarding.service';

const techDetailActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('offboard'), reason: z.string().default('แจ้งพ้นสภาพจาก INT') }),
  z.object({ action: z.literal('refund') }),
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const { code } = await context.params;
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

    const tech = await prisma.technician.findUnique({
      where: { code },
      include: {
        ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 100 },
        warrantyClaims: { where: { status: 'OPEN' } },
        jobPayments: true,
      },
    });
    if (!tech) {
      return NextResponse.json({ message: 'ไม่พบบัญชีช่าง' }, { status: 404 });
    }

    const activeHoldJobs = tech.jobPayments.filter((j) =>
      ['RETAINED', 'HOLD', 'DUE', 'WAIT_APPROVAL'].includes(j.stage2Status),
    );
    const totalPaid = tech.ledgerEntries
      .filter((e) => e.entryType === 'STAGE1_PAYOUT' || e.entryType === 'STAGE2_PAYOUT')
      .reduce((s, e) => s + Number(e.amount), 0);

    return NextResponse.json({
      technician: {
        code: tech.code,
        fullName: tech.fullName,
        status: tech.status,
        depositStatus: tech.depositStatus,
        supplierCode: tech.supplierCode,
        bankAccountMask: tech.bankAccountMask,
        taxIdMask: tech.taxIdMask,
        depositBalance: Number(tech.depositBalance),
        outstandingDebt: Number(tech.outstandingDebt),
        totalPaid,
        heldRetentionTotal: activeHoldJobs.reduce(
          (s, j) => s + Number(j.stage2RemainingAmount),
          0,
        ),
        activeWarrantyJobCount: activeHoldJobs.length,
        openClaimCount: tech.warrantyClaims.length,
      },
      ledger: tech.ledgerEntries.map((e) => ({
        id: e.id,
        timestamp: formatBangkokDateTime(e.createdAt),
        entryType: e.entryType,
        referenceCode: e.referenceCode,
        description: e.description,
        amount: Number(e.amount),
        balanceAfter: Number(e.balanceAfter),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  try {
    const { code } = await context.params;
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    if (!actor) {
      return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = techDetailActionSchema.parse(await request.json());
    const svc = new OffboardingService(prisma);

    if (body.action === 'offboard') {
      assertRole(actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER', 'ADMIN']);
      const updated = await svc.markOffboarding({
        technicianCode: code,
        reason: body.reason,
      });
      return NextResponse.json({ status: updated.status });
    }

    const refundItem = await svc.requestDepositRefund({
      technicianCode: code,
      actor,
    });
    return NextResponse.json(
      { payableId: refundItem.id, refundAmount: Number(refundItem.amount) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
