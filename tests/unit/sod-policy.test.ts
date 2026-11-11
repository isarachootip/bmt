import { describe, expect, it } from 'vitest';
import {
  assertApprovalPermission,
  SegregationOfDutiesError,
} from '@/domain/approval/sod-policy';
import { AuthorizationError } from '@/lib/auth';

describe('Phase 3: Segregation of Duties (SoD) & 50,000 THB Tiered Limit Policy (M5)', () => {
  it('blocks PAYMENT_OFFICER and AUDITOR from approving items', () => {
    expect(() =>
      assertApprovalPermission({
        actor: { id: 'u1', fullName: 'วรรณา', role: 'PAYMENT_OFFICER' },
        decision: 'APPROVE',
        batchTotalAmount: 1800,
        approverLimit: 50000,
        creatorUserIds: [null],
      }),
    ).toThrow(AuthorizationError);
  });

  it('SOW TC10: blocks an approver from approving an item they created themselves (SoD)', () => {
    expect(() =>
      assertApprovalPermission({
        actor: { id: 'u-teera', fullName: 'ธีระ', role: 'FINANCE_MANAGER' },
        decision: 'APPROVE',
        batchTotalAmount: 10000,
        approverLimit: 50000,
        creatorUserIds: ['u-teera'],
      }),
    ).toThrow(SegregationOfDutiesError);
  });

  it('enforces 50,000 THB batch limit for APPROVER and allows FINANCE_MANAGER above limit', () => {
    expect(() =>
      assertApprovalPermission({
        actor: { id: 'u-somporn', fullName: 'สมพร', role: 'APPROVER' },
        decision: 'APPROVE',
        batchTotalAmount: 50000,
        approverLimit: 50000,
        creatorUserIds: [null],
      }),
    ).not.toThrow();

    expect(() =>
      assertApprovalPermission({
        actor: { id: 'u-somporn', fullName: 'สมพร', role: 'APPROVER' },
        decision: 'APPROVE',
        batchTotalAmount: 50000.01,
        approverLimit: 50000,
        creatorUserIds: [null],
      }),
    ).toThrow(AuthorizationError);

    expect(() =>
      assertApprovalPermission({
        actor: { id: 'u-teera', fullName: 'ธีระ', role: 'FINANCE_MANAGER' },
        decision: 'APPROVE',
        batchTotalAmount: 120000,
        approverLimit: 50000,
        creatorUserIds: [null],
      }),
    ).not.toThrow();
  });

  it('requires a non-empty reason note when rejecting', () => {
    expect(() =>
      assertApprovalPermission({
        actor: { id: 'u-somporn', fullName: 'สมพร', role: 'APPROVER' },
        decision: 'REJECT',
        note: '   ',
        batchTotalAmount: 1800,
        approverLimit: 50000,
        creatorUserIds: [null],
      }),
    ).toThrow();
  });
});
