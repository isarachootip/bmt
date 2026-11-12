import { z } from 'zod';

function cleanEnvValue(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^["']|["']$/g, '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const envSchema = z.object({
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'ต้องเป็นตัวอักษรเลขฐานสิบหก (0-9, a-f) ความยาว 64 ตัวอักษร',
    )
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  STATEMENT_SIGNING_SECRET: z
    .string()
    .min(16, 'ต้องมีความยาวอย่างน้อย 16 ตัวอักษร')
    .default('bmt-statement-hmac-secret-key-2026-prod-replace'),
  AUTH_SESSION_SECRET: z
    .string()
    .min(16, 'ต้องมีความยาวอย่างน้อย 16 ตัวอักษร')
    .default('bmt-internal-session-hmac-secret-2026-prod-replace'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseAppEnv(
  rawEnv: Record<string, string | undefined>,
): AppEnv {
  return envSchema.parse({
    ENCRYPTION_KEY: cleanEnvValue(rawEnv.ENCRYPTION_KEY),
    STATEMENT_SIGNING_SECRET: cleanEnvValue(rawEnv.STATEMENT_SIGNING_SECRET),
    AUTH_SESSION_SECRET: cleanEnvValue(rawEnv.AUTH_SESSION_SECRET),
    NEXT_PUBLIC_APP_URL: cleanEnvValue(rawEnv.NEXT_PUBLIC_APP_URL),
  });
}

export function getEnv(): AppEnv {
  return parseAppEnv(process.env);
}
