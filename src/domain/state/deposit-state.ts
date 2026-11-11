import { StateTransitionError } from './technician-state';

export const DepositStatus = {
  AWAITING: 'AWAITING',
  RECEIVED: 'RECEIVED',
  VERIFIED: 'VERIFIED',
  PARTIAL_DEDUCTED: 'PARTIAL_DEDUCTED',
  TOPUP_RECEIVED: 'TOPUP_RECEIVED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
} as const;

export type DepositStatusValue = (typeof DepositStatus)[keyof typeof DepositStatus];

const ALLOWED_DEPOSIT_TRANSITIONS: Record<
  DepositStatusValue,
  readonly DepositStatusValue[]
> = {
  AWAITING: ['RECEIVED'],
  RECEIVED: ['VERIFIED', 'AWAITING'],
  VERIFIED: ['PARTIAL_DEDUCTED', 'REFUND_PENDING'],
  PARTIAL_DEDUCTED: ['PARTIAL_DEDUCTED', 'TOPUP_RECEIVED', 'REFUND_PENDING', 'REFUNDED'],
  TOPUP_RECEIVED: ['VERIFIED', 'PARTIAL_DEDUCTED'],
  REFUND_PENDING: ['REFUNDED', 'VERIFIED', 'PARTIAL_DEDUCTED'],
  REFUNDED: [],
};

export function canTransitionDeposit(
  from: DepositStatusValue,
  to: DepositStatusValue,
): boolean {
  return ALLOWED_DEPOSIT_TRANSITIONS[from].includes(to);
}

export function assertDepositTransition(
  from: DepositStatusValue,
  to: DepositStatusValue,
): void {
  if (!canTransitionDeposit(from, to)) {
    throw new StateTransitionError('GuaranteeDeposit', from, to);
  }
}
