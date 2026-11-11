import type { PayableItem, PrismaClient } from '@prisma/client';
import { LineOaAdapter } from '@/integrations/lon.adapter';
import { OracleFinancialsAdapter } from '@/integrations/oracle.adapter';
import { AuditRepository, type DbClient } from '@/repositories/audit.repo';
import { ConfigRepository } from '@/repositories/config.repo';
import { DepositLedgerRepository } from '@/repositories/deposit.repo';

export class OracleDispatchService {
  constructor(private readonly prisma: PrismaClient) {}

  async dispatchPayableInTx(tx: DbClient, payableId: string): Promise<PayableItem> {
    const cfgRepo = new ConfigRepository(tx);
    const auditRepo = new AuditRepository(tx);
    const depRepo = new DepositLedgerRepository(tx);
    const oracleAdapter = new OracleFinancialsAdapter(tx);
    const lonAdapter = new LineOaAdapter(tx);

    const setting = await cfgRepo.getSystemSetting();
    const item = await tx.payableItem.findUniqueOrThrow({
      where: { id: payableId },
      include: { technician: true },
    });

    const supplierCode = item.technician.supplierCode ?? `SUP-10${item.technician.code.slice(-3)}`;

    await tx.payableItem.update({
      where: { id: item.id },
      data: { status: 'SENT_TO_ORACLE' },
    });

    const dispatchRes = await oracleAdapter.sendPaymentRequestWithRetry(
      {
        idempotencyKey: item.idempotencyKey,
        supplierCode,
        amount: Number(item.amount),
        currency: 'THB',
        reference: `${item.bookingRef} / ${item.title}`,
      },
      setting.oracleSimMode,
      3,
    );

    if (!dispatchRes.success) {
      const failed = await tx.payableItem.update({
        where: { id: item.id },
        data: { status: 'SYNC_FAILED', oracleAttempts: dispatchRes.attempts },
      });
      if (item.jobPaymentId && item.kind === 'STAGE1') {
        await tx.jobPayment.update({
          where: { id: item.jobPaymentId },
          data: { stage1Status: 'SYNC_FAILED' },
        });
      }
      if (item.jobPaymentId && item.kind === 'STAGE2') {
        await tx.jobPayment.update({
          where: { id: item.jobPaymentId },
          data: { stage2Status: 'SYNC_FAILED' },
        });
      }
      await auditRepo.append({
        actorName: 'Oracle API',
        actorRole: 'SYSTEM',
        action: 'ส่ง Payment Request ล้มเหลว',
        entityRef: item.bookingRef,
        oldValue: 'SENT_TO_ORACLE',
        newValue: `SYNC_FAILED · ครั้งที่ ${dispatchRes.attempts}/3 (${dispatchRes.errorMessage ?? 'Error'})`,
      });
      return failed;
    }

    const now = new Date();
    const paidItem = await tx.payableItem.update({
      where: { id: item.id },
      data: {
        status: 'PAID',
        oracleAttempts: dispatchRes.attempts,
        oracleDocNo: dispatchRes.oracleDocNo ?? null,
        paidAt: now,
      },
    });

    if (item.jobPaymentId && item.kind === 'STAGE1') {
      await tx.jobPayment.update({
        where: { id: item.jobPaymentId },
        data: { stage1Status: 'PAID' },
      });
    } else if (item.jobPaymentId && item.kind === 'STAGE2') {
      await tx.jobPayment.update({
        where: { id: item.jobPaymentId },
        data: { stage2Status: 'PAID' },
      });
    } else if (item.kind === 'DEPOSIT_REFUND') {
      await tx.technician.update({
        where: { id: item.technicianId },
        data: { status: 'CLOSED', depositStatus: 'REFUNDED', depositBalance: 0 },
      });
    }

    await depRepo.appendLedger({
      technicianId: item.technicianId,
      entryType:
        item.kind === 'STAGE1'
          ? 'STAGE1_PAYOUT'
          : item.kind === 'STAGE2'
            ? 'STAGE2_PAYOUT'
            : item.kind === 'DEPOSIT_REFUND'
              ? 'DEPOSIT_REFUND'
              : 'MANUAL_ADJUSTMENT',
      referenceCode: dispatchRes.oracleDocNo ?? item.bookingRef,
      description: item.title,
      amount: Number(item.amount),
      balanceAfter: Number(item.technician.depositBalance),
    });

    await lonAdapter.pushTechnicianNotification({
      technicianCode: item.technician.code,
      technicianName: item.technician.fullName,
      message: `โอนเงินสำเร็จ ฿${Number(item.amount).toFixed(2)} (${item.title})`,
      reference: item.bookingRef,
    });

    await auditRepo.append({
      actorName: 'Oracle API',
      actorRole: 'SYSTEM',
      action: 'อนุมัติและจ่ายเงินสำเร็จ (ไม่ผ่าน IPO)',
      entityRef: item.bookingRef,
      oldValue: 'SENT_TO_ORACLE',
      newValue: `PAID · ฿${Number(item.amount).toFixed(2)} · ${dispatchRes.oracleDocNo}`,
    });

    return paidItem;
  }

  async reconcileDaily(): Promise<{ checked: number; failedPending: number }> {
    const all = await this.prisma.payableItem.findMany({
      where: { status: { in: ['SENT_TO_ORACLE', 'ORACLE_APPROVED', 'PAID', 'SYNC_FAILED'] } },
    });
    const failedPending = all.filter((i) => i.status === 'SYNC_FAILED').length;
    const auditRepo = new AuditRepository(this.prisma);
    await auditRepo.append({
      actorName: 'ระบบ',
      actorRole: 'SYSTEM',
      action: 'กระทบยอดกับ Oracle (Reconcile)',
      entityRef: 'ORACLE-RECON',
      oldValue: null,
      newValue: `ตรวจแล้ว ${all.length} รายการ · ค้าง SYNC_FAILED ${failedPending} รายการ`,
    });
    return { checked: all.length, failedPending };
  }
}
