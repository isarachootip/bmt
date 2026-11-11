import type { PrismaClient } from '@prisma/client';
import { CloseJobService } from './close-job.service';

export async function seedSampleJobs(prisma: PrismaClient): Promise<void> {
  const closeJobSvc = new CloseJobService(prisma);

  const jobs = [
    {
      bookingNo: 'BK-2611-00418',
      taskCode: '2.3',
      jobTitle: 'ห้องครัว / 2.3 ระบบไฟ',
      jobType: 'R' as const,
      technicianCode: 'TC-0102',
      amount: 2000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-10T10:02:14+07:00',
    },
    {
      bookingNo: 'BK-2611-00402',
      taskCode: 'Q1',
      jobTitle: 'ติดตั้งเครื่องทำน้ำอุ่น',
      jobType: 'Q' as const,
      technicianCode: 'TC-0219',
      amount: 1200,
      qcStatus: 'PASSED',
      confirmedBy: 'สุดา ดูแล',
      closedAt: '2026-11-10T09:15:00+07:00',
    },
    {
      bookingNo: 'BK-2611-00391',
      taskCode: '1.2',
      jobTitle: 'ห้องรับแขก / 1.2 ปูกระเบื้อง',
      jobType: 'R' as const,
      technicianCode: 'TC-0088',
      amount: 8500,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-09T15:30:00+07:00',
    },
    {
      bookingNo: 'BK-2608-00122',
      taskCode: '1.2',
      jobTitle: 'ห้องรับแขก / 1.2 ปูกระเบื้อง',
      jobType: 'R' as const,
      technicianCode: 'TC-0088',
      amount: 8500,
      qcStatus: 'PASSED',
      confirmedBy: 'สุดา ดูแล',
      closedAt: '2026-08-08T14:00:00+07:00',
    },
    {
      bookingNo: 'BK-2609-00211',
      taskCode: '1.1',
      jobTitle: 'ห้องน้ำ / 1.1 รื้อถอน',
      jobType: 'R' as const,
      technicianCode: 'TC-0102',
      amount: 3000,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-08-11T11:00:00+07:00',
    },
    {
      bookingNo: 'BK-2611-00431',
      taskCode: '2.3',
      jobTitle: 'ระบบไฟ (ช่างยังไม่ ACTIVE)',
      jobType: 'R' as const,
      technicianCode: 'TC-0461',
      amount: 3200,
      qcStatus: 'PASSED',
      confirmedBy: 'นภา ใส่ใจ',
      closedAt: '2026-11-10T17:24:00+07:00',
    },
  ];

  for (const j of jobs) {
    await closeJobSvc.ingestCloseJob(j);
  }

  // Mark historical August jobs as Stage1 PAID, one DUE, and one HOLD with open claim
  const dueJob = await prisma.jobPayment.findUnique({
    where: { bookingNo_taskCode: { bookingNo: 'BK-2608-00122', taskCode: '1.2' } },
  });
  if (dueJob) {
    await prisma.jobPayment.update({
      where: { id: dueJob.id },
      data: { stage1Status: 'PAID', stage2Status: 'DUE' },
    });
    await prisma.payableItem.updateMany({
      where: { jobPaymentId: dueJob.id, kind: 'STAGE1' },
      data: { status: 'PAID', oracleDocNo: 'ORA-AP-8801', paidAt: new Date('2026-08-10T10:00:00+07:00') },
    });
    await prisma.payableItem.create({
      data: {
        idempotencyKey: 'BMT-BK-2608-00122-1.2-STAGE2',
        kind: 'STAGE2',
        technicianId: dueJob.technicianId,
        jobPaymentId: dueJob.id,
        bookingRef: 'BK-2608-00122 · 1.2',
        title: 'ปล่อยเงิน Hold 10% · ห้องรับแขก / 1.2 ปูกระเบื้อง',
        amount: dueJob.stage2RemainingAmount,
        status: 'WAIT_APPROVAL',
      },
    });
  }

  const holdJob = await prisma.jobPayment.findUnique({
    where: { bookingNo_taskCode: { bookingNo: 'BK-2609-00211', taskCode: '1.1' } },
  });
  if (holdJob) {
    await prisma.jobPayment.update({
      where: { id: holdJob.id },
      data: { stage1Status: 'PAID', stage2Status: 'HOLD' },
    });
    await prisma.payableItem.updateMany({
      where: { jobPaymentId: holdJob.id, kind: 'STAGE1' },
      data: { status: 'PAID', oracleDocNo: 'ORA-AP-8820', paidAt: new Date('2026-08-13T10:00:00+07:00') },
    });
    await prisma.warrantyClaim.create({
      data: {
        claimNo: 'CL-0093',
        jobPaymentId: holdJob.id,
        technicianId: holdJob.technicianId,
        status: 'OPEN',
        reason: 'ยาแนวซึมบริเวณมุมห้องน้ำ ลูกค้าแจ้งซ่อมในระยะประกัน',
      },
    });
  }
}
