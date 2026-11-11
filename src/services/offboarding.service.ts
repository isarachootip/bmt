import type { PayableItem, PrismaClient, Technician } from '@prisma/client';
import { subtractMoney } from '@/domain/money/decimal';
import { buildPayableIdempotencyKey } from '@/domain/payment/calculator';
import { assertTechnicianTransition } from '@/domain/state/technician-state';
import { IntSystemAdapter } from '@/integrations/int.adapter';
import { assertRole, type ActorContext } from '@/lib/auth';
import { AuditRepository } from '@/repositories/audit.repo';

export class OffboardingService {
  constructor(private readonly prisma: PrismaClient) {}

  async markOffboarding(params: {
    technicianCode: string;
    reason: string;
  }): Promise<Technician> {
    return this.prisma.$transaction(async (tx) => {
      const tech = await tx.technician.findUniqueOrThrow({
        where: { code: params.technicianCode },
      });
      if (tech.status !== 'OFFBOARDING') {
        assertTechnicianTransition(tech.status, 'OFFBOARDING');
      }

      const updated = await tx.technician.update({
        where: { id: tech.id },
        data: { status: 'OFFBOARDING', offboardedAt: new Date() },
      });

      await new IntSystemAdapter(tx).notifyTechnicianReadiness({
        technicianCode: tech.code,
        status: 'OFFBOARDING',
        readyForJobs: false,
        depositBalance: Number(tech.depositBalance),
        reason: params.reason,
      });

      await new AuditRepository(tx).append({
        actorName: 'INT Offboard Event',
        actorRole: 'SYSTEM',
        action: 'แจ้งช่างพ้นสภาพ (OFFBOARDING)',
        entityRef: tech.code,
        oldValue: tech.status,
        newValue: `OFFBOARDING · ${params.reason}`,
      });

      return updated;
    });
  }

  async requestDepositRefund(params: {
    technicianCode: string;
    actor: ActorContext;
  }): Promise<PayableItem> {
    assertRole(params.actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER']);

    return this.prisma.$transaction(async (tx) => {
      const tech = await tx.technician.findUniqueOrThrow({
        where: { code: params.technicianCode },
        include: {
          warrantyClaims: { where: { status: 'OPEN' } },
          jobPayments: {
            where: {
              stage2Status: { in: ['RETAINED', 'HOLD', 'DUE', 'WAIT_APPROVAL'] },
            },
          },
        },
      });

      if (tech.status !== 'OFFBOARDING') {
        throw new Error('สร้างรายการคืนเงินค้ำประกันได้เฉพาะช่างที่พ้นสภาพ (OFFBOARDING) แล้วเท่านั้น');
      }
      if (tech.warrantyClaims.length > 0) {
        throw new Error(`ไม่สามารถคืนเงินได้ ยังมีเคลมค้าง ${tech.warrantyClaims.length} งาน`);
      }
      if (tech.jobPayments.length > 0) {
        throw new Error(
          `ไม่สามารถคืนเงินได้ ยังมีงานอยู่ในระยะรับประกันหรือรอปล่อย Hold ${tech.jobPayments.length} งาน`,
        );
      }

      const netRefund = subtractMoney(
        Number(tech.depositBalance),
        Number(tech.outstandingDebt),
      );
      if (netRefund <= 0) {
        throw new Error('ไม่มียอดเงินค้ำประกันสุทธิคงเหลือให้คืนหลังหักภาระคงค้าง');
      }

      await tx.technician.update({
        where: { id: tech.id },
        data: { depositStatus: 'REFUND_PENDING', outstandingDebt: 0 },
      });

      const payable = await tx.payableItem.create({
        data: {
          idempotencyKey: buildPayableIdempotencyKey(
            `REFUND-${tech.code}`,
            'DEP',
            'DEPOSIT_REFUND',
          ),
          kind: 'DEPOSIT_REFUND',
          technicianId: tech.id,
          bookingRef: `DEP-REFUND-${tech.code}`,
          title: `คืนเงินค้ำประกันช่างพ้นสภาพ · ${tech.fullName}`,
          amount: netRefund,
          status: 'WAIT_APPROVAL',
          createdByUserId: params.actor.id,
        },
      });

      await new AuditRepository(tx).append({
        actorName: params.actor.fullName,
        actorRole: params.actor.role,
        actorUserId: params.actor.id,
        action: 'สร้างรายการขออนุมัติคืนเงินค้ำประกัน',
        entityRef: tech.code,
        oldValue: 'VERIFIED',
        newValue: `REFUND_PENDING · ยอดคืนสุทธิ ฿${netRefund.toFixed(2)}`,
      });

      return payable;
    });
  }
}
