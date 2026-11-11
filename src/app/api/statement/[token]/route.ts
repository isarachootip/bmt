import { NextResponse } from 'next/server';
import { verifyStatementToken } from '@/domain/security/statement-token';
import { handleApiError } from '@/lib/api-response';
import { getEnv } from '@/lib/env';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDate } from '@/lib/timezone';
import { ensureBootstrapped } from '@/services/bootstrap.service';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await context.params;
    const { STATEMENT_SIGNING_SECRET } = getEnv();
    const verified = verifyStatementToken(token, STATEMENT_SIGNING_SECRET);
    if (!verified.valid) {
      return NextResponse.json(
        { error: 'INVALID_STATEMENT_TOKEN', message: 'ลิงก์ดู Statement ไม่ถูกต้องหรือหมดอายุ' },
        { status: 401 },
      );
    }

    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);

    const tech = await prisma.technician.findUnique({
      where: { code: verified.technicianCode },
      include: {
        jobPayments: {
          include: { claims: { where: { status: 'OPEN' } } },
          orderBy: { closedAt: 'desc' },
        },
      },
    });

    if (!tech) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'ไม่พบข้อมูลบัญชีช่าง' },
        { status: 404 },
      );
    }

    const paidStage1 = tech.jobPayments
      .filter((j) => j.stage1Status === 'PAID')
      .reduce((s, j) => s + Number(j.stage1Amount), 0);
    const paidStage2 = tech.jobPayments
      .filter((j) => j.stage2Status === 'PAID')
      .reduce((s, j) => s + Number(j.stage2RemainingAmount), 0);
    const heldTotal = tech.jobPayments
      .filter((j) => ['RETAINED', 'HOLD', 'DUE', 'WAIT_APPROVAL'].includes(j.stage2Status))
      .reduce((s, j) => s + Number(j.stage2RemainingAmount), 0);

    return NextResponse.json({
      technician: {
        code: tech.code,
        fullName: tech.fullName,
        status: tech.status,
        bankAccountMask: tech.bankAccountMask,
        depositBalance: Number(tech.depositBalance),
        outstandingDebt: Number(tech.outstandingDebt),
        totalReceived: paidStage1 + paidStage2,
        heldRetentionTotal: heldTotal,
      },
      jobs: tech.jobPayments.map((j) => ({
        id: j.id,
        bookingNo: j.bookingNo,
        taskCode: j.taskCode,
        jobTitle: j.jobTitle,
        jobType: j.jobType,
        totalAmount: Number(j.totalAmount),
        stage1Pct: Number(j.snapshotStage1Pct),
        stage2Pct: Number(j.snapshotStage2Pct),
        stage1Amount: Number(j.stage1Amount),
        stage2RemainingAmount: Number(j.stage2RemainingAmount),
        stage1Status: j.stage1Status,
        stage2Status: j.stage2Status,
        closedDate: formatBangkokDate(j.closedAt),
        warrantyEndDate: formatBangkokDate(j.warrantyEndAt),
        openClaimNo: j.claims[0]?.claimNo ?? null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
