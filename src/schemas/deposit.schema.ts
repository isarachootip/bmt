import { z } from 'zod';

export const recordDepositSchema = z.object({
  technicianCode: z.string().trim().min(3),
  amount: z.number().positive('ยอดเงินต้องมากกว่า 0'),
  evidenceRef: z.string().trim().min(2, 'กรุณาระบุเลขอ้างอิงหลักฐานการโอน'),
  note: z.string().trim().optional(),
});

export const verifyDepositSchema = z.object({
  technicianCode: z.string().trim().min(3),
  note: z.string().trim().optional(),
});

export type RecordDepositInput = z.infer<typeof recordDepositSchema>;
export type VerifyDepositInput = z.infer<typeof verifyDepositSchema>;
