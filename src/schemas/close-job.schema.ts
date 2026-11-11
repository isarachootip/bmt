import { z } from 'zod';

export const jobTypeSchema = z.enum(['Q', 'R', 'MA']);

export const closeJobWebhookSchema = z.object({
  bookingNo: z.string().trim().min(3, 'กรุณาระบุเลข Booking No.'),
  taskCode: z.string().trim().min(1, 'กรุณาระบุรหัส Task'),
  jobTitle: z.string().trim().min(2, 'กรุณาระบุชื่องาน'),
  jobType: jobTypeSchema,
  technicianCode: z.string().trim().min(3, 'กรุณาระบุรหัสช่าง'),
  amount: z.number().positive('ยอดค่างานต้องมากกว่า 0'),
  qcStatus: z.string().trim().min(1),
  confirmedBy: z.string().trim(),
  closedAt: z.string().min(8),
});

export const recheckCloseJobSchema = z.object({
  eventId: z.string().min(3),
});

export type CloseJobWebhookInput = z.infer<typeof closeJobWebhookSchema>;
