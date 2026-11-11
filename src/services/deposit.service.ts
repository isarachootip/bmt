import type { PrismaClient, Technician } from '@prisma/client';
import { assertDepositTransition } from '@/domain/state/deposit-state';
import { assertTechnicianTransition } from '@/domain/state/technician-state';
import { IntSystemAdapter } from '@/integrations/int.adapter';
import { assertRole, type ActorContext } from '@/lib/auth';
import { AuditRepository } from '@/repositories/audit.repo';
import { ConfigRepository } from '@/repositories/config.repo';
import { DepositLedgerRepository } from '@/repositories/deposit.repo';
import { TechnicianRepository } from '@/repositories/technician.repo';
import {
  recordDepositSchema,
  verifyDepositSchema,
} from '@/schemas/deposit.schema';

function buildSupplierCode(technicianCode: string): string {
  const digits = technicianCode.replace(/\D/g, '') || '0000';
  return `SUP-10${digits.slice(-3).padStart(3, '0')}`;
}

export class DepositService {
  constructor(private readonly prisma: PrismaClient) {}

  async recordReceipt(params: {
    technicianCode: string;
    amount: number;
    evidenceRef: string;
    note?: string;
    actor: ActorContext;
  }): Promise<Technician> {
    assertRole(params.actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER', 'ADMIN']);
    const parsed = recordDepositSchema.parse(params);

    return this.prisma.$transaction(async (tx) => {
      const techRepo = new TechnicianRepository(tx);
      const depRepo = new DepositLedgerRepository(tx);
      const auditRepo = new AuditRepository(tx);

      const tech = await techRepo.findByCode(parsed.technicianCode);
      if (!tech) {
        throw new Error(`ไม่พบบัญชีช่าง ${parsed.technicianCode}`);
      }

      const isTopup = tech.depositStatus === 'PARTIAL_DEDUCTED';
      const targetDepStatus = isTopup ? 'TOPUP_RECEIVED' : 'RECEIVED';
      assertDepositTransition(tech.depositStatus, targetDepStatus);

      await depRepo.createDepositTx({
        technicianId: tech.id,
        kind: isTopup ? 'TOPUP' : 'INITIAL',
        amount: parsed.amount,
        evidenceRef: parsed.evidenceRef,
        recordedById: params.actor.id,
        note: parsed.note,
      });

      const updated = await techRepo.updateBalancesAndState(tech.id, {
        depositStatus: targetDepStatus,
      });

      await auditRepo.append({
        actorName: params.actor.fullName,
        actorRole: params.actor.role,
        actorUserId: params.actor.id,
        action: isTopup ? 'บันทึกรับเงิน Top-up ค้ำประกัน' : 'บันทึกรับเงินค้ำประกัน',
        entityRef: tech.code,
        oldValue: tech.depositStatus,
        newValue: `${targetDepStatus} · ฿${parsed.amount.toFixed(2)} (${parsed.evidenceRef})`,
      });

      return updated;
    });
  }

  async verifyReceipt(params: {
    technicianCode: string;
    note?: string;
    actor: ActorContext;
  }): Promise<Technician> {
    assertRole(params.actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER']);
    const parsed = verifyDepositSchema.parse(params);

    return this.prisma.$transaction(async (tx) => {
      const techRepo = new TechnicianRepository(tx);
      const depRepo = new DepositLedgerRepository(tx);
      const cfgRepo = new ConfigRepository(tx);
      const auditRepo = new AuditRepository(tx);
      const intAdapter = new IntSystemAdapter(tx);

      const tech = await techRepo.findByCode(parsed.technicianCode);
      if (!tech) {
        throw new Error(`ไม่พบบัญชีช่าง ${parsed.technicianCode}`);
      }

      const unverified = await depRepo.findLatestUnverifiedDeposit(tech.id);
      if (!unverified) {
        throw new Error(`ไม่มีรายการรับเงินค้ำประกันรอยืนยันของช่าง ${tech.code}`);
      }

      const setting = await cfgRepo.getSystemSetting();
      const requiredAmount = Number(setting.requiredDeposit);
      const newBalance = Number(tech.depositBalance) + Number(unverified.amount);

      if (newBalance < requiredAmount) {
        throw new Error(
          `ยอดเงินค้ำประกันรวม ฿${newBalance.toFixed(2)} ยังไม่ครบเกณฑ์ ฿${requiredAmount.toFixed(2)}`,
        );
      }

      assertDepositTransition(tech.depositStatus, 'VERIFIED');
      assertTechnicianTransition(tech.status, 'ACTIVE');

      await depRepo.markDepositVerified(unverified.id, params.actor.id);
      await depRepo.appendLedger({
        technicianId: tech.id,
        entryType: unverified.kind === 'TOPUP' ? 'DEPOSIT_TOPUP' : 'DEPOSIT_IN',
        referenceCode: unverified.evidenceRef ?? `DEP-${tech.code}`,
        description:
          unverified.kind === 'TOPUP'
            ? 'ยืนยันเงิน Top-up ค้ำประกันครบเกณฑ์'
            : 'ยืนยันรับเงินค้ำประกันช่าง',
        amount: Number(unverified.amount),
        balanceAfter: newBalance,
      });

      const supplierCode = tech.supplierCode ?? buildSupplierCode(tech.code);
      const updated = await techRepo.updateBalancesAndState(tech.id, {
        status: 'ACTIVE',
        depositStatus: 'VERIFIED',
        depositBalance: newBalance,
        supplierCode,
      });

      await intAdapter.notifyTechnicianReadiness({
        technicianCode: updated.code,
        status: 'ACTIVE',
        readyForJobs: true,
        depositBalance: newBalance,
        reason: 'ยืนยันเงินค้ำประกันครบเกณฑ์แล้ว',
      });

      await auditRepo.append({
        actorName: params.actor.fullName,
        actorRole: params.actor.role,
        actorUserId: params.actor.id,
        action: 'ยืนยันรับเงินค้ำประกัน',
        entityRef: updated.code,
        oldValue: `${tech.status} / ${tech.depositStatus}`,
        newValue: `ACTIVE / VERIFIED · ฿${newBalance.toFixed(2)} · ${supplierCode} · แจ้ง INT แล้ว`,
      });

      return updated;
    });
  }
}
