import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';
import { OnboardingService } from '@/services/onboarding.service';
import { DepositService } from '@/services/deposit.service';
import { CloseJobService } from '@/services/close-job.service';
import { ApprovalService } from '@/services/approval.service';
import { SegregationOfDutiesError } from '@/domain/approval/sod-policy';
import { AuthorizationError } from '@/lib/auth';

const OFFICER = { id: 'usr-wanna', fullName: 'วรรณา (Finance)', role: 'PAYMENT_OFFICER' as const };
const APPROVER = { id: 'usr-somporn', fullName: 'สมพร (Approver)', role: 'APPROVER' as const };
const FIN_MGR = { id: 'usr-teera', fullName: 'ธีระ (Finance Mgr)', role: 'FINANCE_MANAGER' as const };

describe('Phase 3 & 4: Approval Workflow, SoD & Oracle Retry/Reconcile (SOW TC 6, 7, 10)', () => {
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

  it('SOW TC6: approves in BMT without IPO, dispatches to Oracle immediately, and marks PAID + LON notified', async () => {
    const prisma = await getTestPrisma();
    const cj = new CloseJobService(prisma);
    const approval = new ApprovalService(prisma);

    await cj.ingestCloseJob({
      bookingNo: 'BK-2611-00418',
      taskCode: '2.3',
      jobTitle: 'ห้องครัว / 2.3 ระบบไฟ',
      jobType: 'R',
      technicianCode: 'TC-0102',
      amount: 2000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-10T10:02:14+07:00',
    });

    const item = await prisma.payableItem.findFirstOrThrow();
    const res = await approval.decideBatch({
      payableIds: [item.id],
      decision: 'APPROVE',
      actor: APPROVER,
    });

    expect(res.processedCount).toBe(1);
    const updatedItem = await prisma.payableItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updatedItem.status).toBe('PAID');
    expect(updatedItem.oracleDocNo).toMatch(/^ORA-AP-/);

    // Locked after sent to Oracle: cannot adjust amount directly
    await expect(
      approval.adjustPayableAmountBeforeOracle(item.id, 1900, OFFICER),
    ).rejects.toThrow();

    // Line OA notification recorded
    const lonLogs = await prisma.integrationLog.findMany({ where: { targetSystem: 'LON' } });
    expect(lonLogs).toHaveLength(1);
  });

  it('SOW TC7: retries Oracle 3 times on HTTP 503 -> SYNC_FAILED, then succeeds on manual resend', async () => {
    const prisma = await getTestPrisma();
    await prisma.systemSetting.update({
      where: { id: 'singleton' },
      data: { oracleSimMode: 'FAIL_503' },
    });

    const cj = new CloseJobService(prisma);
    const approval = new ApprovalService(prisma);
    await cj.ingestCloseJob({
      bookingNo: 'BK-2611-00384',
      taskCode: 'Q1',
      jobTitle: 'ติดตั้งเครื่องทำน้ำอุ่น',
      jobType: 'Q',
      technicianCode: 'TC-0102',
      amount: 1200,
      qcStatus: 'PASSED',
      confirmedBy: 'สุดา ดูแล',
      closedAt: '2026-11-09T10:00:00+07:00',
    });

    const item = await prisma.payableItem.findFirstOrThrow();
    await approval.decideBatch({
      payableIds: [item.id],
      decision: 'APPROVE',
      actor: APPROVER,
    });

    const failed = await prisma.payableItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(failed.status).toBe('SYNC_FAILED');
    expect(failed.oracleAttempts).toBe(3);

    const attempts = await prisma.integrationLog.findMany({
      where: { targetSystem: 'ORACLE', idempotencyKey: failed.idempotencyKey },
    });
    expect(attempts).toHaveLength(3);

    // Recover Oracle and press Resend
    await prisma.systemSetting.update({
      where: { id: 'singleton' },
      data: { oracleSimMode: 'NORMAL' },
    });
    const resent = await approval.resendFailedItem(item.id, OFFICER);
    expect(resent.status).toBe('PAID');
  });

  it('SOW TC10 & Limit: blocks self-approval (SoD) and escalates > 50,000 THB to Finance Manager', async () => {
    const prisma = await getTestPrisma();
    const approval = new ApprovalService(prisma);
    const tech = await prisma.technician.findFirstOrThrow({ where: { code: 'TC-0102' } });

    // Item manually created by Finance Manager Teera -> Teera cannot approve it himself!
    const manualAdj = await approval.createAdjustmentPayable({
      technicianCode: tech.code,
      bookingRef: 'ADJ-2611-01',
      title: 'ปรับปรุงค่าเดินทางเพิ่มเติม',
      amount: 500,
      actor: FIN_MGR,
    });

    await expect(
      approval.decideBatch({
        payableIds: [manualAdj.id],
        decision: 'APPROVE',
        actor: FIN_MGR,
      }),
    ).rejects.toThrow(SegregationOfDutiesError);

    // Large job > 50,000 THB (total 60,000 -> stage1 = 54,000 THB)
    const cj = new CloseJobService(prisma);
    await cj.ingestCloseJob({
      bookingNo: 'BK-2611-99999',
      taskCode: 'R-BIG',
      jobTitle: 'รีโนเวททั้งชั้น',
      jobType: 'R',
      technicianCode: 'TC-0102',
      amount: 60000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-10T12:00:00+07:00',
    });

    const bigItem = await prisma.payableItem.findFirstOrThrow({
      where: { bookingRef: 'BK-2611-99999 · R-BIG' },
    });

    await expect(
      approval.decideBatch({
        payableIds: [bigItem.id],
        decision: 'APPROVE',
        actor: APPROVER,
      }),
    ).rejects.toThrow(AuthorizationError);

    const mgrRes = await approval.decideBatch({
      payableIds: [bigItem.id],
      decision: 'APPROVE',
      actor: FIN_MGR,
    });
    expect(mgrRes.processedCount).toBe(1);
  });
});
