import { describe, expect, it } from 'vitest';
import {
  assertTechnicianTransition,
  TechnicianStatus,
} from '@/domain/state/technician-state';
import {
  assertDepositTransition,
  DepositStatus,
} from '@/domain/state/deposit-state';
import {
  assertStage1Transition,
  assertStage2Transition,
  Stage1Status,
  Stage2Status,
} from '@/domain/state/installment-state';

describe('Backend State Machines (No State Skipping)', () => {
  it('enforces valid Technician lifecycle and blocks skipping deposit verification', () => {
    expect(() =>
      assertTechnicianTransition(TechnicianStatus.PENDING_DEPOSIT, TechnicianStatus.ACTIVE),
    ).not.toThrow();
    expect(() =>
      assertTechnicianTransition(TechnicianStatus.ACTIVE, TechnicianStatus.SUSPENDED),
    ).not.toThrow();
    expect(() =>
      assertTechnicianTransition(TechnicianStatus.SUSPENDED, TechnicianStatus.ACTIVE),
    ).not.toThrow();
    expect(() =>
      assertTechnicianTransition(TechnicianStatus.ACTIVE, TechnicianStatus.OFFBOARDING),
    ).not.toThrow();
    expect(() =>
      assertTechnicianTransition(TechnicianStatus.OFFBOARDING, TechnicianStatus.CLOSED),
    ).not.toThrow();

    expect(() =>
      assertTechnicianTransition(TechnicianStatus.PENDING_DEPOSIT, TechnicianStatus.CLOSED),
    ).toThrow();
    expect(() =>
      assertTechnicianTransition(TechnicianStatus.ACTIVE, TechnicianStatus.CLOSED),
    ).toThrow();
  });

  it('enforces Guarantee Deposit transitions including partial claim deduction and top-up', () => {
    expect(() =>
      assertDepositTransition(DepositStatus.AWAITING, DepositStatus.RECEIVED),
    ).not.toThrow();
    expect(() =>
      assertDepositTransition(DepositStatus.RECEIVED, DepositStatus.VERIFIED),
    ).not.toThrow();
    expect(() =>
      assertDepositTransition(DepositStatus.VERIFIED, DepositStatus.PARTIAL_DEDUCTED),
    ).not.toThrow();
    expect(() =>
      assertDepositTransition(DepositStatus.PARTIAL_DEDUCTED, DepositStatus.TOPUP_RECEIVED),
    ).not.toThrow();
    expect(() =>
      assertDepositTransition(DepositStatus.TOPUP_RECEIVED, DepositStatus.VERIFIED),
    ).not.toThrow();
    expect(() =>
      assertDepositTransition(DepositStatus.VERIFIED, DepositStatus.REFUND_PENDING),
    ).not.toThrow();
    expect(() =>
      assertDepositTransition(DepositStatus.REFUND_PENDING, DepositStatus.REFUNDED),
    ).not.toThrow();

    expect(() =>
      assertDepositTransition(DepositStatus.AWAITING, DepositStatus.VERIFIED),
    ).toThrow();
  });

  it('enforces Stage 1 (90%) and Stage 2 (10% Hold) installment transitions', () => {
    expect(() =>
      assertStage1Transition(Stage1Status.CALCULATED, Stage1Status.WAIT_APPROVAL),
    ).not.toThrow();
    expect(() =>
      assertStage1Transition(Stage1Status.WAIT_APPROVAL, Stage1Status.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertStage1Transition(Stage1Status.APPROVED, Stage1Status.SENT_TO_ORACLE),
    ).not.toThrow();
    expect(() =>
      assertStage1Transition(Stage1Status.SENT_TO_ORACLE, Stage1Status.SYNC_FAILED),
    ).not.toThrow();
    expect(() =>
      assertStage1Transition(Stage1Status.SYNC_FAILED, Stage1Status.SENT_TO_ORACLE),
    ).not.toThrow();
    expect(() =>
      assertStage1Transition(Stage1Status.SENT_TO_ORACLE, Stage1Status.ORACLE_APPROVED),
    ).not.toThrow();
    expect(() =>
      assertStage1Transition(Stage1Status.ORACLE_APPROVED, Stage1Status.PAID),
    ).not.toThrow();

    // Cannot jump directly from WAIT_APPROVAL to PAID
    expect(() =>
      assertStage1Transition(Stage1Status.WAIT_APPROVAL, Stage1Status.PAID),
    ).toThrow();

    // Stage 2: RETAINED <-> HOLD -> DUE -> WAIT_APPROVAL -> APPROVED -> SENT_TO_ORACLE -> ORACLE_APPROVED -> PAID
    expect(() =>
      assertStage2Transition(Stage2Status.RETAINED, Stage2Status.HOLD),
    ).not.toThrow();
    expect(() =>
      assertStage2Transition(Stage2Status.HOLD, Stage2Status.RETAINED),
    ).not.toThrow();
    expect(() =>
      assertStage2Transition(Stage2Status.RETAINED, Stage2Status.DUE),
    ).not.toThrow();
    expect(() =>
      assertStage2Transition(Stage2Status.HOLD, Stage2Status.DEDUCTED_FULL),
    ).not.toThrow();
    expect(() =>
      assertStage2Transition(Stage2Status.HOLD, Stage2Status.WAIT_APPROVAL),
    ).toThrow();
  });
});
