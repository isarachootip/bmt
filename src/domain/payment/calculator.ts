import Decimal from 'decimal.js';
import { roundMoney, subtractMoney } from '@/domain/money/decimal';
import { addBangkokDays } from '@/lib/timezone';

export interface CalculateSplitInput {
  totalAmount: number;
  stage1Percent: number;
  warrantyDays: number;
  closedAt: Date;
}

export interface CalculateSplitResult {
  totalAmount: number;
  stage1Amount: number;
  stage2Amount: number;
  snapshotStage1Pct: number;
  snapshotStage2Pct: number;
  snapshotWarrantyDays: number;
  warrantyEndAt: Date;
}

export function calculateInstallmentSplit(
  input: CalculateSplitInput,
): CalculateSplitResult {
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error('ยอดค่างานรวมต้องมากกว่า 0 บาท');
  }
  if (
    !Number.isFinite(input.stage1Percent) ||
    input.stage1Percent < 0 ||
    input.stage1Percent > 100
  ) {
    throw new Error('อัตรางวดแรกต้องอยู่ระหว่าง 0 ถึง 100%');
  }
  if (!Number.isInteger(input.warrantyDays) || input.warrantyDays < 0) {
    throw new Error('ระยะรับประกันต้องเป็นจำนวนเต็มไม่ติดลบ');
  }

  const total = roundMoney(input.totalAmount);
  const pct1 = roundMoney(input.stage1Percent);
  const pct2 = subtractMoney(100, pct1);

  const stage1 = new Decimal(total)
    .mul(pct1)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
  const stage2 = subtractMoney(total, stage1);

  return {
    totalAmount: total,
    stage1Amount: stage1,
    stage2Amount: stage2,
    snapshotStage1Pct: pct1,
    snapshotStage2Pct: pct2,
    snapshotWarrantyDays: input.warrantyDays,
    warrantyEndAt: addBangkokDays(input.closedAt, input.warrantyDays),
  };
}

export function buildPayableIdempotencyKey(
  bookingNo: string,
  taskCode: string,
  kind: 'STAGE1' | 'STAGE2' | 'DEPOSIT_REFUND' | 'ADJUSTMENT',
): string {
  return `BMT-${bookingNo.trim()}-${taskCode.trim()}-${kind}`;
}
