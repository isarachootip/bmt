import { z } from 'zod';

export const userRoleSchema = z.enum([
  'PAYMENT_OFFICER',
  'APPROVER',
  'FINANCE_MANAGER',
  'ADMIN',
  'AUDITOR',
]);

export type AppUserRole = z.infer<typeof userRoleSchema>;

export const loginInputSchema = z.object({
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
  password: z.string().min(4, 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร'),
});

export const roleSwitchInputSchema = z.object({
  email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
