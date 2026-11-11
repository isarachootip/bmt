import { z } from 'zod';

export const decideBatchSchema = z.object({
  payableIds: z.array(z.string().min(3)).min(1, 'กรุณาเลือกรายการอย่างน้อย 1 รายการ'),
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().optional(),
});

export const createAdjustmentSchema = z.object({
  technicianCode: z.string().trim().min(3),
  bookingRef: z.string().trim().min(3),
  title: z.string().trim().min(3),
  amount: z.number().positive(),
});

export type DecideBatchInput = z.infer<typeof decideBatchSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
