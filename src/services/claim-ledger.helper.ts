import type { CascadeDeductionResult } from '@/domain/claims/cascade-deduction';
import type { DbClient } from '@/repositories/audit.repo';
import { DepositLedgerRepository } from '@/repositories/deposit.repo';

export async function recordClaimDeductionEntriesInTx(
  tx: DbClient,
  params: {
    technicianId: string;
    bookingNo: string;
    claimNo: string;
    note?: string;
    cascade: CascadeDeductionResult;
  },
): Promise<void> {
  const depRepo = new DepositLedgerRepository(tx);
  const { technicianId, bookingNo, claimNo, note, cascade } = params;

  if (cascade.deductedFromHold > 0) {
    await depRepo.appendLedger({
      technicianId,
      entryType: 'CLAIM_DEDUCT_HOLD',
      referenceCode: claimNo,
      description: `หักค่าเสียหายเคลมจากเงิน Hold (${bookingNo})`,
      amount: -cascade.deductedFromHold,
      balanceAfter: cascade.newDepositBalance,
    });
  }

  if (cascade.deductedFromDeposit > 0) {
    await depRepo.createDepositTx({
      technicianId,
      kind: 'CLAIM_DEDUCTION',
      amount: -cascade.deductedFromDeposit,
      evidenceRef: claimNo,
      note,
    });
    await depRepo.appendLedger({
      technicianId,
      entryType: 'CLAIM_DEDUCT_DEPOSIT',
      referenceCode: claimNo,
      description: 'หักค่าเสียหายเคลมส่วนเกินจากเงินค้ำประกัน',
      amount: -cascade.deductedFromDeposit,
      balanceAfter: cascade.newDepositBalance,
    });
  }

  if (cascade.recordedDebt > 0) {
    await depRepo.appendLedger({
      technicianId,
      entryType: 'DEBT_RECORDED',
      referenceCode: claimNo,
      description: 'บันทึกหนี้คงค้างส่วนเกินเงินค้ำประกัน',
      amount: -cascade.recordedDebt,
      balanceAfter: cascade.newDepositBalance,
    });
  }
}
