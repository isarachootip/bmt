import type { PrismaClient } from '@prisma/client';
import { ApprovalService } from './approval.service';
import { ClaimService } from './claim.service';
import { CloseJobService } from './close-job.service';

const DEMO_JOBS = [
  { bookingNo: 'BK-2611-00455', taskCode: '4.1', jobTitle: 'รีโนเวททั้งหลัง / 4.1 งานโครงสร้างและฝ้าเพดาน', jobType: 'R' as const, technicianCode: 'TC-0312', amount: 62000, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-11-11T16:20:00+07:00' },
  { bookingNo: 'BK-2611-00418', taskCode: '2.3', jobTitle: 'ห้องครัว / 2.3 ระบบไฟและเต้ารับ', jobType: 'R' as const, technicianCode: 'TC-0102', amount: 12500, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-11-10T10:02:14+07:00' },
  { bookingNo: 'BK-2611-00402', taskCode: 'Q1', jobTitle: 'งานด่วน / ติดตั้งเครื่องทำน้ำอุ่นและสายดิน', jobType: 'Q' as const, technicianCode: 'TC-0219', amount: 3500, qcStatus: 'PASSED', confirmedBy: 'สุดา ดูแล', closedAt: '2026-11-10T09:15:00+07:00' },
  { bookingNo: 'BK-2611-00391', taskCode: '1.2', jobTitle: 'ห้องรับแขก / 1.2 ปูกระเบื้องแกรนิตโต้', jobType: 'R' as const, technicianCode: 'TC-0088', amount: 18500, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-11-09T15:30:00+07:00' },
  { bookingNo: 'BK-2610-00366', taskCode: 'M2', jobTitle: 'บำรุงรักษารายเดือน / ล้างแอร์สำนักงาน 6 เครื่อง', jobType: 'MA' as const, technicianCode: 'TC-0188', amount: 9000, qcStatus: 'PASSED', confirmedBy: 'สุดา ดูแล', closedAt: '2026-10-25T13:45:00+07:00' },
  { bookingNo: 'BK-2610-00340', taskCode: '2.1', jobTitle: 'ห้องนอนใหญ่ / 2.1 ทาสีภายในใหม่', jobType: 'R' as const, technicianCode: 'TC-0188', amount: 14000, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-10-18T11:30:00+07:00' },
  { bookingNo: 'BK-2610-00295', taskCode: '3.1', jobTitle: 'ห้องครัว / 3.1 เดินท่อน้ำดี-น้ำทิ้งซิงค์', jobType: 'R' as const, technicianCode: 'TC-0274', amount: 15000, qcStatus: 'PASSED', confirmedBy: 'สุดา ดูแล', closedAt: '2026-10-04T14:10:00+07:00' },
  { bookingNo: 'BK-2609-00254', taskCode: '1.4', jobTitle: 'โรงจอดรถ / 1.4 งานกันซึมดาดฟ้า', jobType: 'R' as const, technicianCode: 'TC-0312', amount: 24000, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-09-19T16:00:00+07:00' },
  { bookingNo: 'BK-2609-00211', taskCode: '1.1', jobTitle: 'ห้องน้ำชั้นบน / 1.1 รื้อถอนและยาแนวกันซึม', jobType: 'R' as const, technicianCode: 'TC-0102', amount: 16000, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-08-20T11:00:00+07:00' },
  { bookingNo: 'BK-2608-00122', taskCode: '1.2', jobTitle: 'โถงทางเดิน / 1.2 ปูกระเบื้องพื้นครบประกัน', jobType: 'R' as const, technicianCode: 'TC-0088', amount: 22000, qcStatus: 'PASSED', confirmedBy: 'สุดา ดูแล', closedAt: '2026-08-05T14:00:00+07:00' },
];

const REJECTED_AND_DUP_EVENTS = [
  { bookingNo: 'BK-2611-00418', taskCode: '2.3', jobTitle: 'ห้องครัว / 2.3 ระบบไฟและเต้ารับ', jobType: 'R' as const, technicianCode: 'TC-0102', amount: 12500, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-11-10T10:05:00+07:00' },
  { bookingNo: 'BK-2611-00431', taskCode: '2.3', jobTitle: 'งานระบบไฟ (ช่างยังรอตรวจเงินค้ำ)', jobType: 'R' as const, technicianCode: 'TC-0461', amount: 4800, qcStatus: 'PASSED', confirmedBy: 'นภา ใส่ใจ', closedAt: '2026-11-10T17:24:00+07:00' },
  { bookingNo: 'BK-2611-00449', taskCode: '1.3', jobTitle: 'ติดตั้งฉากกั้นอาบน้ำ (QC รอเก็บงานซ้ำ)', jobType: 'Q' as const, technicianCode: 'TC-0219', amount: 3200, qcStatus: 'FAILED', confirmedBy: 'สุดา ดูแล', closedAt: '2026-11-11T11:10:00+07:00' },
];

export async function seedSampleJobs(prisma: PrismaClient): Promise<void> {
  const closeJobSvc = new CloseJobService(prisma);
  const approvalSvc = new ApprovalService(prisma);
  const claimSvc = new ClaimService(prisma);

  for (const job of DEMO_JOBS) {
    const existing = await prisma.jobPayment.findUnique({
      where: { bookingNo_taskCode: { bookingNo: job.bookingNo, taskCode: job.taskCode } },
    });
    if (!existing) {
      await closeJobSvc.ingestCloseJob(job);
    }
  }

  const eventCount = await prisma.closeJobEvent.count();
  if (eventCount <= DEMO_JOBS.length) {
    for (const ev of REJECTED_AND_DUP_EVENTS) {
      await closeJobSvc.ingestCloseJob(ev);
    }
  }

  // Approve & dispatch historical Stage 1 jobs via real ApprovalService (generates Oracle + LON logs)
  const somporn = await prisma.user.findUnique({ where: { email: 'somporn@company.co.th' } });
  if (somporn) {
    const paidTargets = [
      'BMT-BK-2610-00366-M2-STAGE1',
      'BMT-BK-2610-00295-3.1-STAGE1',
      'BMT-BK-2609-00254-1.4-STAGE1',
      'BMT-BK-2609-00211-1.1-STAGE1',
      'BMT-BK-2608-00122-1.2-STAGE1',
    ];
    const pendingToPay = await prisma.payableItem.findMany({
      where: { idempotencyKey: { in: paidTargets }, status: 'WAIT_APPROVAL' },
    });
    for (const item of pendingToPay) {
      await approvalSvc.decideBatch({
        payableIds: [item.id],
        decision: 'APPROVE',
        note: 'อนุมัติจ่ายงวดแรก 90% ตามรอบตรวจรับงาน',
        actor: { id: somporn.id, fullName: somporn.fullName, role: somporn.role },
      });
    }
  }

  // Stage 2 DUE release item ready in Approval Queue
  const dueJob = await prisma.jobPayment.findUnique({
    where: { bookingNo_taskCode: { bookingNo: 'BK-2608-00122', taskCode: '1.2' } },
  });
  if (dueJob && dueJob.stage2Status === 'RETAINED') {
    await prisma.jobPayment.update({
      where: { id: dueJob.id },
      data: { stage2Status: 'DUE' },
    });
    await prisma.payableItem.upsert({
      where: { idempotencyKey: 'BMT-BK-2608-00122-1.2-STAGE2' },
      update: {},
      create: {
        idempotencyKey: 'BMT-BK-2608-00122-1.2-STAGE2',
        kind: 'STAGE2',
        technicianId: dueJob.technicianId,
        jobPaymentId: dueJob.id,
        bookingRef: 'BK-2608-00122 · 1.2',
        title: 'ปล่อยเงิน Hold 10% · โถงทางเดิน / 1.2 ปูกระเบื้องพื้นครบประกัน',
        amount: dueJob.stage2RemainingAmount,
        status: 'WAIT_APPROVAL',
      },
    });
  }

  // Showcase 1 SYNC_FAILED item in Oracle Monitor ready for 1-click Retry
  const syncFailItem = await prisma.payableItem.findUnique({
    where: { idempotencyKey: 'BMT-BK-2610-00340-2.1-STAGE1' },
  });
  if (syncFailItem && syncFailItem.status === 'WAIT_APPROVAL' && somporn) {
    await prisma.payableItem.update({
      where: { id: syncFailItem.id },
      data: {
        status: 'SYNC_FAILED',
        decidedByUserId: somporn.id,
        decidedByName: somporn.fullName,
        decidedAt: new Date('2026-10-19T10:15:00+07:00'),
        oracleAttempts: 3,
      },
    });
    if (syncFailItem.jobPaymentId) {
      await prisma.jobPayment.update({
        where: { id: syncFailItem.jobPaymentId },
        data: { stage1Status: 'SYNC_FAILED' },
      });
    }
    await prisma.integrationLog.create({
      data: {
        targetSystem: 'ORACLE',
        direction: 'OUTBOUND',
        endpoint: 'POST /oracle/ap/v1/invoices',
        idempotencyKey: syncFailItem.idempotencyKey,
        httpStatus: 503,
        requestBody: JSON.stringify({ idempotencyKey: syncFailItem.idempotencyKey, amount: Number(syncFailItem.amount) }),
        responseBody: JSON.stringify({ error: 'ORACLE_503_TIMEOUT', message: 'Oracle AP Gateway timeout after 3 retries' }),
        attempt: 3,
        success: false,
      },
    });
  }

  // Open claim CL-0093 (HOLD) + Cascade-deducted claim CL-0081 (SUSPENDED showcase on TC-0274)
  await claimSvc.openClaim({
    claimNo: 'CL-0093',
    bookingNo: 'BK-2609-00211',
    taskCode: '1.1',
    reason: 'ยาแนวซึมบริเวณมุมห้องน้ำชั้นบน ลูกค้าแจ้งซ่อมในระยะประกัน 90 วัน',
  });

  const existingCascadeClaim = await prisma.warrantyClaim.findUnique({ where: { claimNo: 'CL-0081' } });
  if (!existingCascadeClaim) {
    await claimSvc.openClaim({
      claimNo: 'CL-0081',
      bookingNo: 'BK-2610-00295',
      taskCode: '3.1',
      reason: 'ข้อต่อท่อน้ำทิ้งใต้ซิงค์หลุดซึม ทำตู้บิวท์อินลูกค้าบวมเสียหาย',
    });
    await claimSvc.resolveClaim({
      claimNo: 'CL-0081',
      damageAmount: 5000,
      note: 'หักเงิน Hold งานนี้ 1,500 บาท และหักเงินค้ำประกันช่าง 3,500 บาท (ระงับรับงานชั่วคราวรอเติม Top-up)',
    });
  }
}
