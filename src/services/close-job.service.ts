import type {
  CloseJobEvent,
  CloseJobIntakeResult,
  JobPayment,
  PrismaClient,
} from '@prisma/client';
import {
  buildPayableIdempotencyKey,
  calculateInstallmentSplit,
} from '@/domain/payment/calculator';
import { formatBangkokDate } from '@/lib/timezone';
import { AuditRepository } from '@/repositories/audit.repo';
import { ConfigRepository } from '@/repositories/config.repo';
import { IntegrationLogRepository } from '@/repositories/integration-log.repo';
import { JobPaymentRepository } from '@/repositories/job-payment.repo';
import { TechnicianRepository } from '@/repositories/technician.repo';
import {
  closeJobWebhookSchema,
  type CloseJobWebhookInput,
} from '@/schemas/close-job.schema';

export interface CloseJobProcessResult {
  outcome: CloseJobIntakeResult;
  rejectReason?: string;
  event: CloseJobEvent;
  jobPayment?: JobPayment;
}

export class CloseJobService {
  constructor(private readonly prisma: PrismaClient) {}

  async ingestCloseJob(rawInput: CloseJobWebhookInput): Promise<CloseJobProcessResult> {
    const input = closeJobWebhookSchema.parse(rawInput);
    const rawPayload = JSON.stringify(input, null, 2);

    return this.prisma.$transaction(async (tx) => {
      const techRepo = new TechnicianRepository(tx);
      const jobRepo = new JobPaymentRepository(tx);
      const cfgRepo = new ConfigRepository(tx);
      const auditRepo = new AuditRepository(tx);
      const logRepo = new IntegrationLogRepository(tx);

      let rejectReason: string | undefined;
      if (input.qcStatus.toUpperCase() !== 'PASSED') {
        rejectReason = `ผลตรวจ QC ยังไม่ผ่าน (สถานะ ${input.qcStatus})`;
      } else if (!input.confirmedBy.trim()) {
        rejectReason = 'ยังไม่มีการยืนยันจากทีม Cust-Sat';
      }

      const tech = await techRepo.findByCode(input.technicianCode);
      if (!rejectReason && !tech) {
        rejectReason = `ไม่พบบัญชีช่าง ${input.technicianCode} ในระบบ BMT`;
      } else if (!rejectReason && tech && tech.status !== 'ACTIVE') {
        rejectReason = `ช่าง ${tech.code} สถานะ ${tech.status} (ยังไม่ ACTIVE)`;
      }

      await logRepo.record({
        targetSystem: 'CRM',
        direction: 'INBOUND',
        endpoint: 'POST /api/webhooks/crm/close-job',
        idempotencyKey: `${input.bookingNo}:${input.taskCode}`,
        httpStatus: rejectReason ? 422 : 200,
        requestBody: rawPayload,
        responseBody: JSON.stringify({ rejected: Boolean(rejectReason), rejectReason }),
        success: !rejectReason,
      });

      if (rejectReason || !tech) {
        const event = await jobRepo.recordIntakeEvent({
          bookingNo: input.bookingNo,
          taskCode: input.taskCode,
          jobTitle: input.jobTitle,
          jobType: input.jobType,
          technicianCode: input.technicianCode,
          amount: input.amount,
          qcStatus: input.qcStatus,
          confirmedBy: input.confirmedBy,
          closedAt: new Date(input.closedAt),
          rawPayload,
          result: 'REJECTED',
          rejectReason,
        });
        await auditRepo.append({
          actorName: 'CRM Webhook',
          actorRole: 'SYSTEM',
          action: 'ปฏิเสธ Close Job',
          entityRef: `${input.bookingNo} · ${input.taskCode}`,
          oldValue: null,
          newValue: rejectReason ?? 'ไม่ผ่านเงื่อนไข',
        });
        return { outcome: 'REJECTED', rejectReason, event };
      }

      const existing = await jobRepo.findJobByBookingAndTask(input.bookingNo, input.taskCode);
      if (existing) {
        const event = await jobRepo.recordIntakeEvent({
          bookingNo: input.bookingNo,
          taskCode: input.taskCode,
          jobTitle: input.jobTitle,
          jobType: input.jobType,
          technicianCode: input.technicianCode,
          amount: input.amount,
          qcStatus: input.qcStatus,
          confirmedBy: input.confirmedBy,
          closedAt: new Date(input.closedAt),
          rawPayload,
          result: 'DUPLICATE_UPDATED',
        });
        await auditRepo.append({
          actorName: 'CRM Webhook',
          actorRole: 'SYSTEM',
          action: 'รับ Close Job ซ้ำ (Idempotent)',
          entityRef: `${input.bookingNo} · ${input.taskCode}`,
          oldValue: existing.stage1Status,
          newValue: `${existing.stage1Status} · ไม่สร้างรายการจ่ายซ้ำ`,
        });
        return { outcome: 'DUPLICATE_UPDATED', event, jobPayment: existing };
      }

      const rule = await cfgRepo.getRuleForJobType(input.jobType);
      const closedDate = new Date(input.closedAt);
      const split = calculateInstallmentSplit({
        totalAmount: input.amount,
        stage1Percent: Number(rule.stage1Percent),
        warrantyDays: rule.warrantyDays,
        closedAt: closedDate,
      });

      const jobPayment = await jobRepo.createJobPayment({
        bookingNo: input.bookingNo,
        taskCode: input.taskCode,
        jobTitle: input.jobTitle,
        jobType: input.jobType,
        technician: { connect: { id: tech.id } },
        totalAmount: split.totalAmount,
        snapshotStage1Pct: split.snapshotStage1Pct,
        snapshotStage2Pct: split.snapshotStage2Pct,
        snapshotWarrantyDays: split.snapshotWarrantyDays,
        stage1Amount: split.stage1Amount,
        stage2InitialAmount: split.stage2Amount,
        stage2RemainingAmount: split.stage2Amount,
        closedAt: closedDate,
        warrantyEndAt: split.warrantyEndAt,
        stage1Status: 'WAIT_APPROVAL',
        stage2Status: 'RETAINED',
        confirmedByCustSat: input.confirmedBy,
      });

      await jobRepo.createPayableItem({
        idempotencyKey: buildPayableIdempotencyKey(
          input.bookingNo,
          input.taskCode,
          'STAGE1',
        ),
        kind: 'STAGE1',
        technician: { connect: { id: tech.id } },
        jobPayment: { connect: { id: jobPayment.id } },
        bookingRef: `${input.bookingNo} · ${input.taskCode}`,
        title: `งวดแรก ${split.snapshotStage1Pct}% · ${input.jobTitle}`,
        amount: split.stage1Amount,
        status: 'WAIT_APPROVAL',
        createdByUserId: null,
      });

      const event = await jobRepo.recordIntakeEvent({
        bookingNo: input.bookingNo,
        taskCode: input.taskCode,
        jobTitle: input.jobTitle,
        jobType: input.jobType,
        technicianCode: input.technicianCode,
        amount: input.amount,
        qcStatus: input.qcStatus,
        confirmedBy: input.confirmedBy,
        closedAt: closedDate,
        rawPayload,
        result: 'ACCEPTED',
      });

      await auditRepo.append({
        actorName: 'ระบบ',
        actorRole: 'SYSTEM',
        action: `คำนวณงวด ${split.snapshotStage1Pct}/${split.snapshotStage2Pct}`,
        entityRef: `${input.bookingNo} · ${input.taskCode}`,
        oldValue: 'CALCULATED',
        newValue: `WAIT_APPROVAL · ค่างาน ${split.totalAmount.toFixed(2)} → งวดแรก ${split.stage1Amount.toFixed(2)} · Hold ${split.stage2Amount.toFixed(2)} · พ้นประกัน ${formatBangkokDate(split.warrantyEndAt)}`,
      });

      return { outcome: 'ACCEPTED', event, jobPayment };
    });
  }
}
