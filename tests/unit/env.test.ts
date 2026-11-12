import { describe, expect, it } from 'vitest';
import { parseAppEnv } from '@/lib/env';

describe('Coolify Environment Variable Sanitization (getEnv)', () => {
  it('falls back to safe defaults when Coolify passes empty strings', () => {
    const env = parseAppEnv({
      ENCRYPTION_KEY: '   ',
      STATEMENT_SIGNING_SECRET: '',
      AUTH_SESSION_SECRET: '',
      NEXT_PUBLIC_APP_URL: '',
    });
    expect(env.ENCRYPTION_KEY).toHaveLength(64);
    expect(env.AUTH_SESSION_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it('strips accidental surrounding quotes and whitespace from 64-char hex ENCRYPTION_KEY', () => {
    const rawKey = '9a7b374481228b6fff16a6c3dd81432ea12b40979d3ca45d9410ab1add2c4c59';
    const env = parseAppEnv({
      ENCRYPTION_KEY: `  "${rawKey}"  `,
    });
    expect(env.ENCRYPTION_KEY).toBe(rawKey);
  });
});
