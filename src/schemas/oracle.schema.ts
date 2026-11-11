import { z } from 'zod';

export const resendOracleSchema = z.object({
  payableId: z.string().min(3),
});

export const toggleOracleSimSchema = z.object({
  mode: z.enum(['NORMAL', 'FAIL_503']),
});

export const oracleCallbackSchema = z.object({
  idempotencyKey: z.string().min(5),
  status: z.enum(['ORACLE_APPROVED', 'PAID']),
  oracleDocNo: z.string().min(3),
});
