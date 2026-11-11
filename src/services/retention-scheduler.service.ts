import type { PrismaClient } from '@prisma/client';
import { buildPayableIdempotencyKey } from '@/domain/payment/calculator';
import { isWarrantyExpired } from '@/lib/timezone';
import { AuditRepository, type DbClient } from '@/repositories/audit.repo';

export async function releaseSingleDueStage2InTx(
  tx: DbClient,
  jobId: string,
): Promise<boolean> {
  const job = await tx.jobPayment.findUniqueOrThrow({
    where: { id: jobId },
    include: { claims: { where: { status: 'OPEN' } } },
  });

  if (job.claims.length > 0 || Number(job.stage2RemainingAmount) <= 0) {
    return false;
  }

  const key = buildPayableIdempotencyKey(job.bookingNo, job.taskCode, 'STAGE2');
  const existingPayable = await tx.payableItem.findUnique({
    where: { idempotencyKey: key },
  });
  if (existingPayable) {
    return false;
  }

  await tx.jobPayment.update({
    where: { id: job.id },
    data: { stage2Status: 'WAIT_APPROVAL' },
  });

  await tx.payableItem.create({
    data: {
      idempotencyKey: key,
      kind: 'STAGE2',
      technicianId: job.technicianId,
      jobPaymentId: job.id,
      bookingRef: `${job.bookingNo} · ${job.taskCode}`,
      title: `ปล่อยเงิน Hold ${job.snapshotStage2Pct}% · ${job.jobTitle}`,
      amount: job.stage2RemainingAmount,
      status: 'WAIT_APPROVAL',
      createdByUserId: null,
    },
  });

  await new AuditRepository(tx).append({
    actorName: 'Scheduler เงิน Hold',
    actorRole: 'SYSTEM',
    action: 'ปล่อยเงิน Hold พ้นระยะประกันเข้าคิวอนุมัติ',
    entityRef: `${job.bookingNo} · ${job.taskCode}`,
    oldValue: job.stage2Status,
    newValue: `DUE → WAIT_APPROVAL · ฿${Number(job.stage2RemainingAmount).toFixed(2)}`,
  });

  return true;
}

export class RetentionSchedulerService {
  constructor(private readonly prisma: PrismaClient) {}

  async runDailyRelease(
    referenceNow: Date = new Date(),
  ): Promise<{ scannedCount: number; releasedCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.jobPayment.findMany({
        where: {
          stage1Status: 'PAID',
          stage2Status: { in: ['RETAINED', 'DUE'] },
        },
        include: { claims: { where: { status: 'OPEN' } } },
      });

      let releasedCount = 0;
      for (const job of candidates) {
        if (job.claims.length > 0) continue;
        if (!isWarrantyExpired(job.warrantyEndAt, referenceNow)) continue;

        const didRelease = await releaseSingleDueStage2InTx(tx, job.id);
        if (didRelease) {
          releasedCount += 1;
        }
      }

      return { scannedCount: candidates.length, releasedCount };
    });
  }
}
