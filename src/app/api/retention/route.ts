import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDate } from '@/lib/timezone';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { ClaimService } from '@/services/claim.service';
import { RetentionSchedulerService } from '@/services/retention-scheduler.service';

const retentionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('scheduler') }),
  z.object({
    action: z.literal('openClaim'),
    claimNo: z.string().min(3),
    bookingNo: z.string().min(3),
    taskCode: z.string().min(1),
    reason: z.string().min(3),
  }),
  z.object({
    action: z.literal('resolveClaim'),
    claimNo: z.string().min(3),
    damageAmount: z.number().min(0),
    note: z.string().optional(),
  }),
]);

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

    const jobs = await prisma.jobPayment.findMany({
      include: {
        technician: true,
        claims: { orderBy: { openedAt: 'desc' } },
      },
      orderBy: { warrantyEndAt: 'asc' },
    });

    const nowMs = Date.now();
    return NextResponse.json({
      items: jobs.map((j) => {
        const openClaim = j.claims.find((c) => c.status === 'OPEN');
        const daysLeft = Math.ceil((j.warrantyEndAt.getTime() - nowMs) / 86_400_000);
        return {
          id: j.id,
          bookingNo: j.bookingNo,
          taskCode: j.taskCode,
          jobTitle: j.jobTitle,
          technicianCode: j.technician.code,
          technicianName: j.technician.fullName,
          closedDate: formatBangkokDate(j.closedAt),
          warrantyEndDate: formatBangkokDate(j.warrantyEndAt),
          daysLeft,
          stage1Status: j.stage1Status,
          stage2Status: j.stage2Status,
          stage2InitialAmount: Number(j.stage2InitialAmount),
          stage2RemainingAmount: Number(j.stage2RemainingAmount),
          openClaimNo: openClaim?.claimNo ?? null,
          openClaimReason: openClaim?.reason ?? null,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    assertRole(actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER', 'ADMIN']);

    const body = retentionActionSchema.parse(await request.json());

    if (body.action === 'scheduler') {
      const res = await new RetentionSchedulerService(prisma).runDailyRelease(new Date());
      return NextResponse.json(res);
    }
    if (body.action === 'openClaim') {
      const claim = await new ClaimService(prisma).openClaim(body);
      return NextResponse.json({ claimNo: claim.claimNo }, { status: 201 });
    }
    const resolved = await new ClaimService(prisma).resolveClaim({
      claimNo: body.claimNo,
      damageAmount: body.damageAmount,
      note: body.note,
    });
    return NextResponse.json({
      claimNo: resolved.claimNo,
      deductedFromHold: Number(resolved.deductedFromHold),
      deductedFromDeposit: Number(resolved.deductedFromDeposit),
      recordedDebt: Number(resolved.recordedDebt),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
