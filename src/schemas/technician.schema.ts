import { z } from 'zod';

export const intApprovedWebhookSchema = z.object({
  technicianCode: z
    .string()
    .trim()
    .min(3)
    .regex(/^[A-Z0-9-]+$/, 'รหัสช่างต้องเป็นตัวพิมพ์ใหญ่ ตัวเลข หรือขีดกลาง'),
  fullName: z.string().trim().min(2, 'กรุณาระบุชื่อ-นามสกุลช่าง'),
  bankName: z.string().trim().min(2, 'กรุณาระบุธนาคาร'),
  bankAccountNo: z.string().trim().min(6, 'เลขบัญชีธนาคารไม่ถูกต้อง'),
  taxId: z.string().trim().min(10, 'เลขผู้เสียภาษีไม่ถูกต้อง'),
  approvedAt: z.string().datetime({ offset: true }).or(z.string().min(8)),
});

export const intOffboardWebhookSchema = z.object({
  technicianCode: z.string().trim().min(3),
  offboardedAt: z.string().optional(),
  reason: z.string().trim().default('พ้นสภาพช่างในระบบ INT'),
});

export type IntApprovedWebhookInput = z.infer<typeof intApprovedWebhookSchema>;
export type IntOffboardWebhookInput = z.infer<typeof intOffboardWebhookSchema>;
