import type { PrismaClient, WarrantyClaim } from '@prisma/client';
import { computeClaimCascadeDeduction } from '@/domain/claims/cascade-deduction';
import { assertStage2Transition } from '@/domain/state/installment-state';
import { IntSystemAdapter } from '@/integrations/int.adapter';
import { LineOaAdapter } from '@/integrations/lon.adapter';
import { isWarrantyExpired } from '@/lib/timezone';
import { AuditRepository } from '@/repositories/audit.repo';
import { ClaimRepository } from '@/repositories/claim.repo';
import { ConfigRepository } from '@/repositories/config.repo';
import { openClaimSchema, resolveClaimSchema } from '@/schemas/claim.schema';
import { recordClaimDeductionEntriesInTx } from './claim-ledger.helper';
import { releaseSingleDueStage2InTx } from './retention-scheduler.service';

export class ClaimService {
  constructor(private readonly prisma: PrismaClient) {}

  async openClaim(rawInput: {
    claimNo: string;
    bookingNo: string;
    taskCode: string;
    reason: string;
  }): Promise<WarrantyClaim> {
    const input = openClaimSchema.parse(rawInput);

    return this.prisma.$transaction(async (tx) => {
      const claimRepo = new ClaimRepository(tx);
      const existing = await claimRepo.findByClaimNo(input.claimNo);
      if (existing) return existing;

      const job = await tx.jobPayment.findUnique({
        where: {
          bookingNo_taskCode: { bookingNo: input.bookingNo, taskCode: input.taskCode },
        },
      });
      if (!job) {
        throw new Error(`ไม่พบงาน ${input.bookingNo} · ${input.taskCode}`);
      }

      if (job.stage2Status !== 'HOLD') {
        assertStage2Transition(job.stage2Status, 'HOLD');
        await tx.jobPayment.update({
          where: { id: job.id },
          data: { stage2Status: 'HOLD' },
        });
      }

      const claim = await claimRepo.create({
        claimNo: input.claimNo,
        jobPayment: { connect: { id: job.id } },
        technician: { connect: { id: job.technicianId } },
        reason: input.reason,
        status: 'OPEN',
      });

      await new AuditRepository(tx).append({
        actorName: 'CRM Claim Webhook',
        actorRole: 'SYSTEM',
        action: `เปิดเคลม ${input.claimNo} · ระงับเงิน Hold`,
        entityRef: `${job.bookingNo} · ${job.taskCode}`,
        oldValue: job.stage2Status,
        newValue: `HOLD · ${input.reason}`,
      });

      return claim;
    });
  }

  async resolveClaim(params: {
    claimNo: string;
    damageAmount: number;
    note?: string;
    referenceNow?: Date;
  }): Promise<WarrantyClaim> {
    const parsed = resolveClaimSchema.parse(params);
    const now = params.referenceNow ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.warrantyClaim.findUniqueOrThrow({
        where: { claimNo: parsed.claimNo },
        include: { jobPayment: true, technician: true },
      });
      if (claim.status !== 'OPEN') {
        throw new Error(`เคลม ${parsed.claimNo} ถูกปิดไปแล้ว`);
      }

      const setting = await new ConfigRepository(tx).getSystemSetting();
      const cascade = computeClaimCascadeDeduction({
        damageAmount: parsed.damageAmount,
        stage2Remaining: Number(claim.jobPayment.stage2RemainingAmount),
        depositBalance: Number(claim.technician.depositBalance),
        existingDebt: Number(claim.technician.outstandingDebt),
        requiredDeposit: Number(setting.requiredDeposit),
      });

      const updatedClaim = await tx.warrantyClaim.update({
        where: { id: claim.id },
        data: {
          status: parsed.damageAmount > 0 ? 'CLOSED_DEDUCTED' : 'CLOSED_NO_DAMAGE',
          damageAmount: parsed.damageAmount,
          deductedFromHold: cascade.deductedFromHold,
          deductedFromDeposit: cascade.deductedFromDeposit,
          recordedDebt: cascade.recordedDebt,
          closedAt: now,
        },
      });

      await recordClaimDeductionEntriesInTx(tx, {
        technicianId: claim.technicianId,
        bookingNo: claim.jobPayment.bookingNo,
        claimNo: claim.claimNo,
        note: parsed.note,
        cascade,
      });

      const nextTechStatus =
        cascade.shouldSuspendTechnician && claim.technician.status === 'ACTIVE'
          ? 'SUSPENDED'
          : claim.technician.status;
      const nextDepStatus =
        cascade.newDepositBalance < Number(setting.requiredDeposit)
          ? 'PARTIAL_DEDUCTED'
          : claim.technician.depositStatus;

      await tx.technician.update({
        where: { id: claim.technicianId },
        data: {
          status: nextTechStatus,
          depositStatus: nextDepStatus,
          depositBalance: cascade.newDepositBalance,
          outstandingDebt: cascade.newTotalDebt,
        },
      });

      if (nextTechStatus === 'SUSPENDED' && claim.technician.status !== 'SUSPENDED') {
        await new IntSystemAdapter(tx).notifyTechnicianReadiness({
          technicianCode: claim.technician.code,
          status: 'SUSPENDED',
          readyForJobs: false,
          depositBalance: cascade.newDepositBalance,
          reason: `ถูกหักเคลม ${claim.claimNo} เงินค้ำประกันต่ำกว่าเกณฑ์`,
        });
        await new LineOaAdapter(tx).pushTechnicianNotification({
          technicianCode: claim.technician.code,
          technicianName: claim.technician.fullName,
          message: `บัญชีถูกระงับชั่วคราวเนื่องจากหักเคลม ${claim.claimNo} กรุณาโอนเติมเงินค้ำประกัน`,
          reference: claim.claimNo,
        });
      }

      const nextStage2 =
        cascade.newStage2Remaining <= 0
          ? 'DEDUCTED_FULL'
          : isWarrantyExpired(claim.jobPayment.warrantyEndAt, now)
            ? 'DUE'
            : 'RETAINED';

      await tx.jobPayment.update({
        where: { id: claim.jobPaymentId },
        data: {
          stage2RemainingAmount: cascade.newStage2Remaining,
          stage2Status: nextStage2,
        },
      });

      if (nextStage2 === 'DUE') {
        await releaseSingleDueStage2InTx(tx, claim.jobPaymentId);
      }

      await new AuditRepository(tx).append({
        actorName: 'CRM Claim Webhook',
        actorRole: 'SYSTEM',
        action: `ปิดเคลม ${claim.claimNo}`,
        entityRef: `${claim.jobPayment.bookingNo} · ${claim.jobPayment.taskCode}`,
        oldValue: 'HOLD',
        newValue: `${nextStage2} · หัก Hold ฿${cascade.deductedFromHold.toFixed(2)} · หักค้ำประกัน ฿${cascade.deductedFromDeposit.toFixed(2)}`,
      });

      return updatedClaim;
    });
  }
}
