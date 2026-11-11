import type { PayableItem, PrismaClient } from '@prisma/client';
import { assertApprovalPermission } from '@/domain/approval/sod-policy';
import { addMoney } from '@/domain/money/decimal';
import { assertRole, type ActorContext } from '@/lib/auth';
import { AuditRepository } from '@/repositories/audit.repo';
import { ConfigRepository } from '@/repositories/config.repo';
import {
  decideBatchSchema,
  type CreateAdjustmentInput,
} from '@/schemas/approval.schema';
import { OracleDispatchService } from './oracle-dispatch.service';
import { PayableAdjustmentService } from './payable-adjustment.service';

export class ApprovalService {
  private readonly oracleSvc: OracleDispatchService;
  private readonly adjSvc: PayableAdjustmentService;

  constructor(private readonly prisma: PrismaClient) {
    this.oracleSvc = new OracleDispatchService(prisma);
    this.adjSvc = new PayableAdjustmentService(prisma);
  }

  async decideBatch(params: {
    payableIds: string[];
    decision: 'APPROVE' | 'REJECT';
    note?: string;
    actor: ActorContext;
  }): Promise<{ processedCount: number }> {
    const parsed = decideBatchSchema.parse(params);

    return this.prisma.$transaction(async (tx) => {
      const setting = await new ConfigRepository(tx).getSystemSetting();
      const auditRepo = new AuditRepository(tx);

      const items = await tx.payableItem.findMany({
        where: { id: { in: parsed.payableIds } },
      });
      if (items.length !== parsed.payableIds.length) {
        throw new Error('บางรายการไม่พบในระบบ กรุณารีเฟรชคิวอนุมัติ');
      }
      for (const item of items) {
        if (item.status !== 'WAIT_APPROVAL') {
          throw new Error(`รายการ ${item.bookingRef} ไม่ได้อยู่ในสถานะรออนุมัติ (${item.status})`);
        }
      }

      const batchTotalAmount = items.reduce(
        (sum, item) => addMoney(sum, Number(item.amount)),
        0,
      );
      assertApprovalPermission({
        actor: params.actor,
        decision: parsed.decision,
        note: parsed.note,
        batchTotalAmount,
        approverLimit: Number(setting.approverLimit),
        creatorUserIds: items.map((i) => i.createdByUserId),
      });

      const now = new Date();
      for (const item of items) {
        if (parsed.decision === 'REJECT') {
          await tx.payableItem.update({
            where: { id: item.id },
            data: {
              status: 'REJECTED',
              decidedByUserId: params.actor.id,
              decidedByName: params.actor.fullName,
              decidedAt: now,
              decisionNote: parsed.note ?? '',
            },
          });
          if (item.jobPaymentId) {
            await tx.jobPayment.update({
              where: { id: item.jobPaymentId },
              data: item.kind === 'STAGE1' ? { stage1Status: 'REJECTED' } : { stage2Status: 'DUE' },
            });
          }
          await auditRepo.append({
            actorName: params.actor.fullName,
            actorRole: params.actor.role,
            actorUserId: params.actor.id,
            action: 'ปฏิเสธรายการจ่าย',
            entityRef: item.bookingRef,
            oldValue: 'WAIT_APPROVAL',
            newValue: `REJECTED · ${parsed.note}`,
          });
        } else {
          await tx.payableItem.update({
            where: { id: item.id },
            data: {
              status: 'APPROVED',
              decidedByUserId: params.actor.id,
              decidedByName: params.actor.fullName,
              decidedAt: now,
              decisionNote: parsed.note ?? null,
            },
          });
          await auditRepo.append({
            actorName: params.actor.fullName,
            actorRole: params.actor.role,
            actorUserId: params.actor.id,
            action: item.kind === 'STAGE2' ? 'อนุมัติปล่อยเงิน Hold' : 'อนุมัติรายการจ่าย',
            entityRef: item.bookingRef,
            oldValue: 'WAIT_APPROVAL',
            newValue: `APPROVED · ฿${Number(item.amount).toFixed(2)}`,
          });

          if (setting.dispatchCadence === 'IMMEDIATE') {
            await this.oracleSvc.dispatchPayableInTx(tx, item.id);
          }
        }
      }

      return { processedCount: items.length };
    });
  }

  async resendFailedItem(payableId: string, actor: ActorContext): Promise<PayableItem> {
    assertRole(actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER', 'ADMIN']);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.payableItem.findUniqueOrThrow({ where: { id: payableId } });
      if (item.status !== 'SYNC_FAILED' && item.status !== 'APPROVED') {
        throw new Error('ส่งซ้ำได้เฉพาะรายการที่สถานะ SYNC_FAILED หรือ APPROVED เท่านั้น');
      }
      await new AuditRepository(tx).append({
        actorName: actor.fullName,
        actorRole: actor.role,
        actorUserId: actor.id,
        action: 'กดส่งซ้ำไปที่ Oracle',
        entityRef: item.bookingRef,
        oldValue: item.status,
        newValue: 'RETRY → SENT_TO_ORACLE',
      });
      return this.oracleSvc.dispatchPayableInTx(tx, item.id);
    });
  }

  createAdjustmentPayable(input: CreateAdjustmentInput & { actor: ActorContext }) {
    return this.adjSvc.createAdjustmentPayable(input);
  }

  adjustPayableAmountBeforeOracle(payableId: string, newAmount: number, actor: ActorContext) {
    return this.adjSvc.adjustPayableAmountBeforeOracle(payableId, newAmount, actor);
  }
}
