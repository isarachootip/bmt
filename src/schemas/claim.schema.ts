import { z } from 'zod';

export const openClaimSchema = z.object({
  claimNo: z.string().trim().min(3),
  bookingNo: z.string().trim().min(3),
  taskCode: z.string().trim().min(1),
  reason: z.string().trim().min(3),
});

export const resolveClaimSchema = z.object({
  claimNo: z.string().trim().min(3),
  damageAmount: z.number().min(0).default(0),
  note: z.string().trim().optional(),
});

export type OpenClaimInput = z.infer<typeof openClaimSchema>;
export type ResolveClaimInput = z.infer<typeof resolveClaimSchema>;
