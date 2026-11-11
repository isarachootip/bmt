import { describe, expect, it } from 'vitest';
import { calculateInstallmentSplit } from '@/domain/payment/calculator';

describe('Phase 2: Decimal 90/10 Payment Split & Snapshot Calculator (M4)', () => {
  it('calculates 90% stage 1 and 10% stage 2 hold on 2,000 THB with 90-day warranty', () => {
    const res = calculateInstallmentSplit({
      totalAmount: 2000,
      stage1Percent: 90,
      warrantyDays: 90,
      closedAt: new Date('2026-11-10T10:02:14+07:00'),
    });

    expect(res.stage1Amount).toBe(1800);
    expect(res.stage2Amount).toBe(200);
    expect(res.stage1Amount + res.stage2Amount).toBe(2000);
    expect(res.snapshotStage2Pct).toBe(10);
  });

  it('guarantees stage1 + stage2 === totalAmount on odd satang rounding (e.g. 85/15 on 333.33)', () => {
    const res = calculateInstallmentSplit({
      totalAmount: 333.33,
      stage1Percent: 85,
      warrantyDays: 30,
      closedAt: new Date('2026-11-10T10:00:00+07:00'),
    });

    // 333.33 * 0.85 = 283.3305 -> 283.33; stage 2 = 333.33 - 283.33 = 50.00
    expect(res.stage1Amount).toBe(283.33);
    expect(res.stage2Amount).toBe(50.0);
    expect(Number((res.stage1Amount + res.stage2Amount).toFixed(2))).toBe(333.33);
  });

  it('rejects non-positive job amounts or out-of-range percentages', () => {
    expect(() =>
      calculateInstallmentSplit({
        totalAmount: 0,
        stage1Percent: 90,
        warrantyDays: 30,
        closedAt: new Date(),
      }),
    ).toThrow();

    expect(() =>
      calculateInstallmentSplit({
        totalAmount: 1000,
        stage1Percent: 105,
        warrantyDays: 30,
        closedAt: new Date(),
      }),
    ).toThrow();
  });
});
