import { StateTransitionError } from './technician-state';

export const Stage1Status = {
  CALCULATED: 'CALCULATED',
  WAIT_APPROVAL: 'WAIT_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT_TO_ORACLE: 'SENT_TO_ORACLE',
  ORACLE_APPROVED: 'ORACLE_APPROVED',
  PAID: 'PAID',
  SYNC_FAILED: 'SYNC_FAILED',
} as const;

export type Stage1StatusValue = (typeof Stage1Status)[keyof typeof Stage1Status];

export const Stage2Status = {
  RETAINED: 'RETAINED',
  HOLD: 'HOLD',
  DUE: 'DUE',
  DEDUCTED_FULL: 'DEDUCTED_FULL',
  WAIT_APPROVAL: 'WAIT_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SENT_TO_ORACLE: 'SENT_TO_ORACLE',
  ORACLE_APPROVED: 'ORACLE_APPROVED',
  PAID: 'PAID',
  SYNC_FAILED: 'SYNC_FAILED',
} as const;

export type Stage2StatusValue = (typeof Stage2Status)[keyof typeof Stage2Status];

const ALLOWED_STAGE1: Record<Stage1StatusValue, readonly Stage1StatusValue[]> = {
  CALCULATED: ['WAIT_APPROVAL'],
  WAIT_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['SENT_TO_ORACLE', 'SYNC_FAILED'],
  REJECTED: ['WAIT_APPROVAL'],
  SENT_TO_ORACLE: ['ORACLE_APPROVED', 'PAID', 'SYNC_FAILED'],
  ORACLE_APPROVED: ['PAID'],
  SYNC_FAILED: ['SENT_TO_ORACLE'],
  PAID: [],
};

const ALLOWED_STAGE2: Record<Stage2StatusValue, readonly Stage2StatusValue[]> = {
  RETAINED: ['HOLD', 'DUE'],
  HOLD: ['RETAINED', 'DUE', 'DEDUCTED_FULL'],
  DUE: ['WAIT_APPROVAL', 'HOLD'],
  DEDUCTED_FULL: [],
  WAIT_APPROVAL: ['APPROVED', 'REJECTED', 'HOLD'],
  APPROVED: ['SENT_TO_ORACLE', 'SYNC_FAILED'],
  REJECTED: ['DUE', 'RETAINED'],
  SENT_TO_ORACLE: ['ORACLE_APPROVED', 'PAID', 'SYNC_FAILED'],
  ORACLE_APPROVED: ['PAID'],
  SYNC_FAILED: ['SENT_TO_ORACLE'],
  PAID: [],
};

export function assertStage1Transition(from: Stage1StatusValue, to: Stage1StatusValue): void {
  if (!ALLOWED_STAGE1[from].includes(to)) {
    throw new StateTransitionError('Stage1Installment', from, to);
  }
}

export function assertStage2Transition(from: Stage2StatusValue, to: Stage2StatusValue): void {
  if (!ALLOWED_STAGE2[from].includes(to)) {
    throw new StateTransitionError('Stage2Retention', from, to);
  }
}

export function isLockedAfterOracle(status: Stage1StatusValue | Stage2StatusValue): boolean {
  return (
    status === 'SENT_TO_ORACLE' ||
    status === 'ORACLE_APPROVED' ||
    status === 'PAID'
  );
}
