import { z } from 'zod';

const envSchema = z.object({
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  STATEMENT_SIGNING_SECRET: z
    .string()
    .min(16)
    .default('bmt-statement-hmac-secret-key-2026-prod-replace'),
  AUTH_SESSION_SECRET: z
    .string()
    .min(16)
    .default('bmt-internal-session-hmac-secret-2026-prod-replace'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    STATEMENT_SIGNING_SECRET: process.env.STATEMENT_SIGNING_SECRET,
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}
