import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';
import { OnboardingService } from '@/services/onboarding.service';
import { DepositService } from '@/services/deposit.service';
import { CloseJobService } from '@/services/close-job.service';
import { SettingsService } from '@/services/settings.service';
import { ReportService } from '@/services/report.service';
import { buildOpenApiSpec } from '@/openapi/spec';
import { AuthorizationError } from '@/lib/auth';

const OFFICER = { id: 'usr-wanna', fullName: 'วรรณา (Finance)', role: 'PAYMENT_OFFICER' as const };
const ADMIN = { id: 'usr-krit', fullName: 'กฤษณ์ (Admin)', role: 'ADMIN' as const };

describe('Phase 6: Admin Settings Snapshot Isolation, Reports & OpenAPI 3.1', () => {
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

  it('enforces ADMIN role on Settings and isolates existing job snapshots when rates change (90/10 -> 85/15)', async () => {
    const prisma = await getTestPrisma();
    const cj = new CloseJobService(prisma);
    const settings = new SettingsService(prisma);

    // First job created under default 90/10
    const before = await cj.ingestCloseJob({
      bookingNo: 'BK-SNAP-001',
      taskCode: 'Q1',
      jobTitle: 'ซ่อมก๊อกน้ำ',
      jobType: 'Q',
      technicianCode: 'TC-0102',
      amount: 2000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา',
      closedAt: '2026-11-10T10:00:00+07:00',
    });
    expect(Number(before.jobPayment?.stage1Amount)).toBe(1800);

    // Non-admin blocked
    await expect(
      settings.updateSettings({
        requiredDeposit: 10000,
        approverLimit: 50000,
        dispatchCadence: 'IMMEDIATE',
        rules: [
          { jobType: 'Q', stage1Percent: 85, warrantyDays: 45 },
          { jobType: 'R', stage1Percent: 85, warrantyDays: 90 },
          { jobType: 'MA', stage1Percent: 85, warrantyDays: 90 },
        ],
        actor: OFFICER,
      }),
    ).rejects.toThrow(AuthorizationError);

    // Admin updates Q to 85/15, 45 days
    await settings.updateSettings({
      requiredDeposit: 10000,
      approverLimit: 80000,
      dispatchCadence: 'IMMEDIATE',
      rules: [
        { jobType: 'Q', stage1Percent: 85, warrantyDays: 45 },
        { jobType: 'R', stage1Percent: 85, warrantyDays: 90 },
        { jobType: 'MA', stage1Percent: 85, warrantyDays: 90 },
      ],
      actor: ADMIN,
    });

    // Existing job snapshot remains 1,800 (90%)
    const existingReloaded = await prisma.jobPayment.findUniqueOrThrow({
      where: { id: before.jobPayment!.id },
    });
    expect(Number(existingReloaded.stage1Amount)).toBe(1800);
    expect(Number(existingReloaded.snapshotStage1Pct)).toBe(90);

    // New job uses updated 85/15 (1,700 / 300) & 45-day warranty
    const after = await cj.ingestCloseJob({
      bookingNo: 'BK-SNAP-002',
      taskCode: 'Q2',
      jobTitle: 'เปลี่ยนวาล์ว',
      jobType: 'Q',
      technicianCode: 'TC-0102',
      amount: 2000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา',
      closedAt: '2026-11-10T11:00:00+07:00',
    });
    expect(Number(after.jobPayment?.stage1Amount)).toBe(1700);
    expect(Number(after.jobPayment?.stage2InitialAmount)).toBe(300);
    expect(after.jobPayment?.snapshotWarrantyDays).toBe(45);
  });

  it('aggregates Financial Dashboard & 4 Reports accurately and exposes OpenAPI 3.1 spec', async () => {
    const prisma = await getTestPrisma();
    const cj = new CloseJobService(prisma);
    await cj.ingestCloseJob({
      bookingNo: 'BK-REP-001',
      taskCode: '1.1',
      jobTitle: 'ทาสีห้องนอน',
      jobType: 'R',
      technicianCode: 'TC-0102',
      amount: 5000,
      qcStatus: 'PASSED',
      confirmedBy: 'สุดา',
      closedAt: '2026-11-10T12:00:00+07:00',
    });

    const reportSvc = new ReportService(prisma);
    const dash = await reportSvc.getDashboardSummary();
    expect(dash.kpis.waitStage1Count).toBe(1);
    expect(dash.kpis.waitStage1Total).toBe(4500);
    expect(dash.depositSummary.totalDepositHeld).toBe(10000);

    const reports = await reportSvc.getReportsData();
    expect(reports.byTechnician).toHaveLength(1);
    expect(reports.byTechnician[0]?.totalJobAmount).toBe(5000);

    const spec = buildOpenApiSpec();
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(10);
  });
});
