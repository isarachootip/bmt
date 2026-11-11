import type { PrismaClient } from '@prisma/client';
import { formatBangkokDate } from '@/lib/timezone';

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDashboardSummary() {
    const [payables, jobs, techs, setting] = await Promise.all([
      this.prisma.payableItem.findMany(),
      this.prisma.jobPayment.findMany({
        include: { technician: true },
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.technician.findMany(),
      this.prisma.systemSetting.findUnique({ where: { id: 'singleton' } }),
    ]);

    const waitStage1 = payables.filter((p) => p.kind === 'STAGE1' && p.status === 'WAIT_APPROVAL');
    const waitStage2 = payables.filter((p) => p.kind === 'STAGE2' && p.status === 'WAIT_APPROVAL');
    const paidStage1 = payables.filter((p) => p.kind === 'STAGE1' && p.status === 'PAID');
    const syncFailed = payables.filter((p) => p.status === 'SYNC_FAILED');

    const heldJobs = jobs.filter((j) =>
      ['RETAINED', 'HOLD', 'DUE', 'WAIT_APPROVAL'].includes(j.stage2Status),
    );

    const bucketMap = new Map<string, number>();
    for (const j of heldJobs) {
      const ym = `${j.warrantyEndAt.getFullYear()}-${String(j.warrantyEndAt.getMonth() + 1).padStart(2, '0')}`;
      bucketMap.set(ym, (bucketMap.get(ym) ?? 0) + Number(j.stage2RemainingAmount));
    }
    const agingBuckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 6)
      .map(([month, amount]) => ({ month, amount }));

    return {
      oracleHealthy: setting?.oracleSimMode !== 'FAIL_503' && syncFailed.length === 0,
      kpis: {
        waitStage1Count: waitStage1.length,
        waitStage1Total: waitStage1.reduce((s, p) => s + Number(p.amount), 0),
        waitStage2Count: waitStage2.length,
        waitStage2Total: waitStage2.reduce((s, p) => s + Number(p.amount), 0),
        paidStage1Count: paidStage1.length,
        paidStage1Total: paidStage1.reduce((s, p) => s + Number(p.amount), 0),
        syncFailedCount: syncFailed.length,
        totalHeldRetention: heldJobs.reduce((s, j) => s + Number(j.stage2RemainingAmount), 0),
      },
      agingBuckets,
      depositSummary: {
        totalDepositHeld: techs.reduce((s, t) => s + Number(t.depositBalance), 0),
        activeCount: techs.filter((t) => t.status === 'ACTIVE').length,
        pendingCount: techs.filter((t) => t.status === 'PENDING_DEPOSIT').length,
        suspendedCount: techs.filter((t) => t.status === 'SUSPENDED').length,
        offboardingCount: techs.filter((t) => t.status === 'OFFBOARDING').length,
      },
      recentJobs: jobs.slice(0, 8).map((j) => ({
        bookingNo: j.bookingNo,
        taskCode: j.taskCode,
        technicianName: j.technician.fullName,
        jobTitle: j.jobTitle,
        totalAmount: Number(j.totalAmount),
        stage1Amount: Number(j.stage1Amount),
        stage2RemainingAmount: Number(j.stage2RemainingAmount),
        stage1Status: j.stage1Status,
        stage2Status: j.stage2Status,
        closedDate: formatBangkokDate(j.closedAt),
      })),
    };
  }

  async getReportsData() {
    const [techs, jobs, payables] = await Promise.all([
      this.prisma.technician.findMany({ include: { jobPayments: true } }),
      this.prisma.jobPayment.findMany({ include: { technician: true } }),
      this.prisma.payableItem.findMany({ include: { technician: true } }),
    ]);

    const byTechnician = techs
      .filter((t) => t.jobPayments.length > 0)
      .map((t) => ({
        code: t.code,
        fullName: t.fullName,
        jobCount: t.jobPayments.length,
        totalJobAmount: t.jobPayments.reduce((s, j) => s + Number(j.totalAmount), 0),
        stage1Total: t.jobPayments.reduce((s, j) => s + Number(j.stage1Amount), 0),
        holdRemaining: t.jobPayments
          .filter((j) => j.stage2Status !== 'PAID')
          .reduce((s, j) => s + Number(j.stage2RemainingAmount), 0),
        holdReleased: t.jobPayments
          .filter((j) => j.stage2Status === 'PAID')
          .reduce((s, j) => s + Number(j.stage2RemainingAmount), 0),
      }));

    return {
      byTechnician,
      aging: jobs
        .filter((j) => j.stage2Status !== 'PAID')
        .map((j) => ({
          bookingRef: `${j.bookingNo} · ${j.taskCode}`,
          technicianName: j.technician.fullName,
          warrantyEndDate: formatBangkokDate(j.warrantyEndAt),
          stage2Status: j.stage2Status,
          holdAmount: Number(j.stage2RemainingAmount),
        })),
      deposits: techs.map((t) => ({
        code: t.code,
        fullName: t.fullName,
        status: t.status,
        depositStatus: t.depositStatus,
        depositBalance: Number(t.depositBalance),
        outstandingDebt: Number(t.outstandingDebt),
      })),
      oracleReconcile: payables.map((p) => ({
        idempotencyKey: p.idempotencyKey,
        bookingRef: p.bookingRef,
        technicianName: p.technician.fullName,
        kind: p.kind,
        amount: Number(p.amount),
        status: p.status,
        oracleDocNo: p.oracleDocNo ?? '-',
      })),
    };
  }
}
