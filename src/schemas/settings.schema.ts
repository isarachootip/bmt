import { z } from 'zod';

export const jobRuleItemSchema = z.object({
  jobType: z.enum(['Q', 'R', 'MA']),
  stage1Percent: z.number().min(0).max(100),
  warrantyDays: z.number().int().min(1).max(3650),
});

export const updateSettingsSchema = z.object({
  requiredDeposit: z.number().positive(),
  approverLimit: z.number().positive(),
  dispatchCadence: z.enum(['IMMEDIATE', 'DAILY_1600', 'WEEKLY']),
  rules: z.array(jobRuleItemSchema).min(1),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
