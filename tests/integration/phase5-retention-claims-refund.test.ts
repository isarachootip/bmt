import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';
import { OnboardingService } from '@/services/onboarding.service';
import { DepositService } from '@/services/deposit.service';
import { CloseJobService } from '@/services/close-job.service';
import { ApprovalService } from '@/services/approval.service';
import { RetentionSchedulerService } from '@/services/retention-scheduler.service';
import { ClaimService } from '@/services/claim.service';
import { OffboardingService } from '@/services/offboarding.service';

const OFFICER = { id: 'usr-wanna', fullName: 'วรรณา (Finance)', role: 'PAYMENT_OFFICER' as const };
const APPROVER = { id: 'usr-somporn', fullName: 'สมพร (Approver)', role: 'APPROVER' as const };

describe('Phase 5: Retention Scheduler, Claim Cascade, Top-up & Offboarding Refund (SOW TC 8-9)', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    const prisma = await getTestPrisma();
    const ob = new OnboardingService(prisma);
    const dep = new DepositService(prisma);
    await ob.ingestApprovedTechnician({
      technicianCode: 'TC-0102',
      fullName: 'สมชาย ใจดี',
      bankName: 'กสิกรไทย',
      bankAccountNo: '045-2-99482-1',
      taxId: '1100700114821',
      approvedAt: '2026-03-14T09:00:00+07:00',
    });
    await dep.recordReceipt({ technicianCode: 'TC-0102', amount: 10000, evidenceRef: 'SLIP-1', actor: OFFICER });
    await dep.verifyReceipt({ technicianCode: 'TC-0102', actor: OFFICER });
  });

  it('SOW TC8 & TC9: releases expired Stage 2 when claim-free, holds claimed jobs, cascades damage -> SUSPENDED -> Top-up ACTIVE', async () => {
    const prisma = await getTestPrisma();
    const cj = new CloseJobService(prisma);
    const approval = new ApprovalService(prisma);
    const scheduler = new RetentionSchedulerService(prisma);
    const claimSvc = new ClaimService(prisma);
    const depSvc = new DepositService(prisma);

    // Job A (Q = 30d warranty, closed 01/10/2026 -> expires 31/10/2026) - no claim
    await cj.ingestCloseJob({
      bookingNo: 'BK-2610-0001',
      taskCode: 'Q1',
      jobTitle: 'ล้างแอร์',
      jobType: 'Q',
      technicianCode: 'TC-0102',
      amount: 1000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา',
      closedAt: '2026-10-01T10:00:00+07:00',
    });

    // Job B (Q = 30d warranty, closed 01/10/2026 -> expires 31/10/2026) - has open claim!
    await cj.ingestCloseJob({
      bookingNo: 'BK-2610-0002',
      taskCode: 'Q2',
      jobTitle: 'ซ่อมท่อน้ำ',
      jobType: 'Q',
      technicianCode: 'TC-0102',
      amount: 2000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา',
      closedAt: '2026-10-01T11:00:00+07:00',
    });

    // Pay Stage 1 for both jobs first
    const stage1Items = await prisma.payableItem.findMany({ where: { kind: 'STAGE1' } });
    await approval.decideBatch({
      payableIds: stage1Items.map((i) => i.id),
      decision: 'APPROVE',
      actor: APPROVER,
    });

    // Open claim on Job B -> Stage 2 becomes HOLD
    await claimSvc.openClaim({
      claimNo: 'CL-2001',
      bookingNo: 'BK-2610-0002',
      taskCode: 'Q2',
      reason: 'ท่อน้ำรั่วซ้ำ',
    });

    // Run Scheduler on 10/11/2026: Job A becomes WAIT_APPROVAL (Stage 2), Job B stays HOLD!
    const runRes = await scheduler.runDailyRelease(new Date('2026-11-10T06:00:00+07:00'));
    expect(runRes.releasedCount).toBe(1);

    const jobB = await prisma.jobPayment.findFirstOrThrow({ where: { bookingNo: 'BK-2610-0002' } });
    expect(jobB.stage2Status).toBe('HOLD');

    // Approve Job A Stage 2 -> PAID
    const stage2Payable = await prisma.payableItem.findFirstOrThrow({ where: { kind: 'STAGE2' } });
    await approval.decideBatch({
      payableIds: [stage2Payable.id],
      decision: 'APPROVE',
      actor: APPROVER,
    });
    const jobA = await prisma.jobPayment.findFirstOrThrow({ where: { bookingNo: 'BK-2610-0001' } });
    expect(jobA.stage2Status).toBe('PAID');

    // Close claim on Job B with 1,500 THB repair damage (Stage 2 Hold = 200 -> 1,300 deducted from Deposit!)
    await claimSvc.resolveClaim({
      claimNo: 'CL-2001',
      damageAmount: 1500,
      note: 'จ้างช่างสำรองเข้าแก้ไข',
      referenceNow: new Date('2026-11-10T15:00:00+07:00'),
    });

    const suspendedTech = await prisma.technician.findUniqueOrThrow({ where: { code: 'TC-0102' } });
    expect(suspendedTech.status).toBe('SUSPENDED');
    expect(Number(suspendedTech.depositBalance)).toBe(8700);

    // Top-up 1,300 THB -> back to ACTIVE!
    await depSvc.recordReceipt({
      technicianCode: 'TC-0102',
      amount: 1300,
      evidenceRef: 'SLIP-TOPUP-1',
      actor: OFFICER,
    });
    const reactivated = await depSvc.verifyReceipt({
      technicianCode: 'TC-0102',
      actor: OFFICER,
    });
    expect(reactivated.status).toBe('ACTIVE');
    expect(Number(reactivated.depositBalance)).toBe(10000);
  });

  it('refunds Guarantee Deposit upon OFFBOARDING once all warranties and claims are cleared', async () => {
    const prisma = await getTestPrisma();
    const offboard = new OffboardingService(prisma);
    const approval = new ApprovalService(prisma);

    await offboard.markOffboarding({
      technicianCode: 'TC-0102',
      reason: 'ช่างแจ้งลาออกใน INT',
    });

    const refundPayable = await offboard.requestDepositRefund({
      technicianCode: 'TC-0102',
      actor: OFFICER,
    });
    expect(Number(refundPayable.amount)).toBe(10000);

    await approval.decideBatch({
      payableIds: [refundPayable.id],
      decision: 'APPROVE',
      actor: APPROVER,
    });

    const closedTech = await prisma.technician.findUniqueOrThrow({ where: { code: 'TC-0102' } });
    expect(closedTech.status).toBe('CLOSED');
    expect(closedTech.depositStatus).toBe('REFUNDED');
    expect(Number(closedTech.depositBalance)).toBe(0);
  });
});
