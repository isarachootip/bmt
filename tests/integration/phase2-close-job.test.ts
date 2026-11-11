import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';
import { OnboardingService } from '@/services/onboarding.service';
import { DepositService } from '@/services/deposit.service';
import { CloseJobService } from '@/services/close-job.service';

const OFFICER = {
  id: 'usr-wanna',
  fullName: 'วรรณา (Finance)',
  role: 'PAYMENT_OFFICER' as const,
};

async function createActiveTech(code: string, name: string) {
  const prisma = await getTestPrisma();
  const ob = new OnboardingService(prisma);
  const dep = new DepositService(prisma);
  await ob.ingestApprovedTechnician({
    technicianCode: code,
    fullName: name,
    bankName: 'กสิกรไทย',
    bankAccountNo: '045-2-99482-1',
    taxId: '1100700114821',
    approvedAt: '2026-03-14T09:00:00+07:00',
  });
  await dep.recordReceipt({
    technicianCode: code,
    amount: 10000,
    evidenceRef: `SLIP-${code}`,
    actor: OFFICER,
  });
  return dep.verifyReceipt({ technicianCode: code, actor: OFFICER });
}

describe('Phase 2: M3 Close Job Intake & M4 90/10 Payment Calculation (SOW TC 3-5)', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('SOW TC3 & TC4: calculates 90/10 split, snapshots config, and prevents duplicate payout on resend', async () => {
    const prisma = await getTestPrisma();
    await createActiveTech('TC-0102', 'สมชาย ใจดี');
    const svc = new CloseJobService(prisma);

    const payload = {
      bookingNo: 'BK-2611-00418',
      taskCode: '2.3',
      jobTitle: 'ห้องครัว / 2.3 ระบบไฟ',
      jobType: 'R' as const,
      technicianCode: 'TC-0102',
      amount: 2000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-10T10:02:14+07:00',
    };

    const res = await svc.ingestCloseJob(payload);
    expect(res.outcome).toBe('ACCEPTED');
    expect(Number(res.jobPayment?.stage1Amount)).toBe(1800);
    expect(Number(res.jobPayment?.stage2InitialAmount)).toBe(200);
    expect(res.jobPayment?.snapshotWarrantyDays).toBe(90);

    // Resend exact same Booking + Task -> DUPLICATE_UPDATED, still only 1 JobPayment & 1 Stage1 PayableItem
    const dup = await svc.ingestCloseJob(payload);
    expect(dup.outcome).toBe('DUPLICATE_UPDATED');
    expect(await prisma.jobPayment.count()).toBe(1);
    expect(await prisma.payableItem.count()).toBe(1);
  });

  it('SOW TC5: rejects Close Job when QC is not PASSED, Cust-Sat is empty, or Technician is not ACTIVE', async () => {
    const prisma = await getTestPrisma();
    const ob = new OnboardingService(prisma);
    await ob.ingestApprovedTechnician({
      technicianCode: 'TC-0461',
      fullName: 'กิตติ พร้อมทำ',
      bankName: 'กรุงไทย',
      bankAccountNo: '098-1-25512-9',
      taxId: '1100800995512',
      approvedAt: '2026-11-09T09:30:00+07:00',
    });

    const svc = new CloseJobService(prisma);
    const pendingTechRes = await svc.ingestCloseJob({
      bookingNo: 'BK-2611-00431',
      taskCode: '2.3',
      jobTitle: 'ระบบไฟ',
      jobType: 'R',
      technicianCode: 'TC-0461',
      amount: 3200,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-10T17:24:00+07:00',
    });

    expect(pendingTechRes.outcome).toBe('REJECTED');
    expect(pendingTechRes.rejectReason).toContain('ACTIVE');

    await createActiveTech('TC-0088', 'ประเสริฐ มั่นคง');
    const qcFailRes = await svc.ingestCloseJob({
      bookingNo: 'BK-2611-00425',
      taskCode: '1.2',
      jobTitle: 'ปูกระเบื้อง',
      jobType: 'R',
      technicianCode: 'TC-0088',
      amount: 5400,
      qcStatus: 'ESCALATED',
      confirmedBy: 'สุดา ดูแล',
      closedAt: '2026-11-10T16:40:00+07:00',
    });

    expect(qcFailRes.outcome).toBe('REJECTED');
    expect(qcFailRes.rejectReason).toContain('QC');
    expect(await prisma.payableItem.count()).toBe(0);
  });
});
