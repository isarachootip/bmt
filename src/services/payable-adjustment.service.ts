import type { PayableItem, PrismaClient } from '@prisma/client';
import { buildPayableIdempotencyKey } from '@/domain/payment/calculator';
import { isLockedAfterOracle } from '@/domain/state/installment-state';
import { assertRole, type ActorContext } from '@/lib/auth';
import { AuditRepository } from '@/repositories/audit.repo';
import {
  createAdjustmentSchema,
  type CreateAdjustmentInput,
} from '@/schemas/approval.schema';

export class PayableAdjustmentService {
  constructor(private readonly prisma: PrismaClient) {}

  async createAdjustmentPayable(
    input: CreateAdjustmentInput & { actor: ActorContext },
  ): Promise<PayableItem> {
    assertRole(input.actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER']);
    const parsed = createAdjustmentSchema.parse(input);

    return this.prisma.$transaction(async (tx) => {
      const tech = await tx.technician.findUniqueOrThrow({
        where: { code: parsed.technicianCode },
      });
      const item = await tx.payableItem.create({
        data: {
          idempotencyKey: buildPayableIdempotencyKey(
            parsed.bookingRef,
            String(Date.now()),
            'ADJUSTMENT',
          ),
          kind: 'ADJUSTMENT',
          technicianId: tech.id,
          bookingRef: parsed.bookingRef,
          title: parsed.title,
          amount: parsed.amount,
          status: 'WAIT_APPROVAL',
          createdByUserId: input.actor.id,
        },
      });
      await new AuditRepository(tx).append({
        actorName: input.actor.fullName,
        actorRole: input.actor.role,
        actorUserId: input.actor.id,
        action: 'สร้างรายการปรับปรุง (Adjustment)',
        entityRef: parsed.bookingRef,
        oldValue: null,
        newValue: `WAIT_APPROVAL · ฿${parsed.amount.toFixed(2)}`,
      });
      return item;
    });
  }

  async adjustPayableAmountBeforeOracle(
    payableId: string,
    newAmount: number,
    actor: ActorContext,
  ): Promise<PayableItem> {
    assertRole(actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER']);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.payableItem.findUniqueOrThrow({ where: { id: payableId } });
      if (isLockedAfterOracle(item.status)) {
        throw new Error(
          'ห้ามแก้ไขยอดเงินหลังส่งเข้า Oracle แล้ว กรุณาสร้างรายการปรับปรุง (Adjustment) แยก',
        );
      }
      return tx.payableItem.update({
        where: { id: payableId },
        data: { amount: newAmount, createdByUserId: actor.id },
      });
    });
  }
}
