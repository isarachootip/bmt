import { addMoney, roundMoney, subtractMoney } from '@/domain/money/decimal';

export interface CascadeDeductionInput {
  damageAmount: number;
  stage2Remaining: number;
  depositBalance: number;
  existingDebt: number;
  requiredDeposit: number;
}

export interface CascadeDeductionResult {
  deductedFromHold: number;
  newStage2Remaining: number;
  deductedFromDeposit: number;
  newDepositBalance: number;
  recordedDebt: number;
  newTotalDebt: number;
  shouldSuspendTechnician: boolean;
}

export function computeClaimCascadeDeduction(
  input: CascadeDeductionInput,
): CascadeDeductionResult {
  if (!Number.isFinite(input.damageAmount) || input.damageAmount < 0) {
    throw new Error('ค่าเสียหายเคลมต้องไม่ติดลบ');
  }

  const damage = roundMoney(input.damageAmount);
  const holdAvail = roundMoney(input.stage2Remaining);
  const depAvail = roundMoney(input.depositBalance);

  const deductedFromHold = Math.min(damage, holdAvail);
  const newStage2Remaining = subtractMoney(holdAvail, deductedFromHold);

  const overflowAfterHold = subtractMoney(damage, deductedFromHold);
  const deductedFromDeposit = Math.min(overflowAfterHold, depAvail);
  const newDepositBalance = subtractMoney(depAvail, deductedFromDeposit);

  const recordedDebt = subtractMoney(overflowAfterHold, deductedFromDeposit);
  const newTotalDebt = addMoney(input.existingDebt, recordedDebt);

  const shouldSuspendTechnician =
    newDepositBalance < roundMoney(input.requiredDeposit) || newTotalDebt > 0;

  return {
    deductedFromHold,
    newStage2Remaining,
    deductedFromDeposit,
    newDepositBalance,
    recordedDebt,
    newTotalDebt,
    shouldSuspendTechnician,
  };
}
