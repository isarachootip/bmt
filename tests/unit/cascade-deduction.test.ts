import { describe, expect, it } from 'vitest';
import { computeClaimCascadeDeduction } from '@/domain/claims/cascade-deduction';

describe('Phase 5: Claim Cascade Deduction Engine (Stage 2 Hold -> Deposit -> Debt)', () => {
  it('leaves balances intact when claim closes with 0 damage', () => {
    const res = computeClaimCascadeDeduction({
      damageAmount: 0,
      stage2Remaining: 300,
      depositBalance: 10000,
      existingDebt: 0,
      requiredDeposit: 10000,
    });

    expect(res.deductedFromHold).toBe(0);
    expect(res.newStage2Remaining).toBe(300);
    expect(res.deductedFromDeposit).toBe(0);
    expect(res.newDepositBalance).toBe(10000);
    expect(res.recordedDebt).toBe(0);
    expect(res.shouldSuspendTechnician).toBe(false);
  });

  it('deducts partially from Stage 2 Hold and preserves remainder for warranty release', () => {
    const res = computeClaimCascadeDeduction({
      damageAmount: 200,
      stage2Remaining: 500,
      depositBalance: 10000,
      existingDebt: 0,
      requiredDeposit: 10000,
    });

    expect(res.deductedFromHold).toBe(200);
    expect(res.newStage2Remaining).toBe(300);
    expect(res.deductedFromDeposit).toBe(0);
    expect(res.newDepositBalance).toBe(10000);
    expect(res.shouldSuspendTechnician).toBe(false);
  });

  it('cascades overflow into Guarantee Deposit and flags SUSPENDED when below 10,000 THB', () => {
    const res = computeClaimCascadeDeduction({
      damageAmount: 1500,
      stage2Remaining: 200,
      depositBalance: 10000,
      existingDebt: 0,
      requiredDeposit: 10000,
    });

    expect(res.deductedFromHold).toBe(200);
    expect(res.newStage2Remaining).toBe(0);
    expect(res.deductedFromDeposit).toBe(1300);
    expect(res.newDepositBalance).toBe(8700);
    expect(res.recordedDebt).toBe(0);
    expect(res.shouldSuspendTechnician).toBe(true);
  });

  it('records excess beyond Guarantee Deposit as Outstanding Debt', () => {
    const res = computeClaimCascadeDeduction({
      damageAmount: 12500,
      stage2Remaining: 200,
      depositBalance: 10000,
      existingDebt: 100,
      requiredDeposit: 10000,
    });

    expect(res.deductedFromHold).toBe(200);
    expect(res.deductedFromDeposit).toBe(10000);
    expect(res.newDepositBalance).toBe(0);
    expect(res.recordedDebt).toBe(2300);
    expect(res.newTotalDebt).toBe(2400);
    expect(res.shouldSuspendTechnician).toBe(true);
  });
});
