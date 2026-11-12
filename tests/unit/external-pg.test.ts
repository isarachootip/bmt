import { describe, expect, it } from 'vitest';
import { resolveDatabaseMode } from '@/lib/external-pg';

describe('External PostgreSQL Mode & Coolify DATABASE_URL Resolution', () => {
  const PLACEHOLDER =
    'postgresql://placeholder:placeholder@127.0.0.1:5432/bmt_db?schema=public';

  it('uses embedded PGlite in development when USE_EXTERNAL_PG is not true', () => {
    const res = resolveDatabaseMode({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://bmt:bmt_secret@localhost:5439/bmt_db?schema=public',
    });
    expect(res).toEqual({ mode: 'embedded' });
  });

  it('uses embedded PGlite in production when DATABASE_URL is unset or build placeholder', () => {
    expect(resolveDatabaseMode({ NODE_ENV: 'production' })).toEqual({
      mode: 'embedded',
    });
    expect(
      resolveDatabaseMode({ NODE_ENV: 'production', DATABASE_URL: PLACEHOLDER }),
    ).toEqual({ mode: 'embedded' });
  });

  it('automatically uses external PostgreSQL in production when Coolify DATABASE_URL is provided', () => {
    const coolifyUrl = 'postgres://postgres:secret123@zvahn1mktde8:5432/postgres';
    const res = resolveDatabaseMode({
      NODE_ENV: 'production',
      DATABASE_URL: coolifyUrl,
    });
    expect(res).toEqual({ mode: 'external', url: coolifyUrl });
  });

  it('uses external PostgreSQL in any env when USE_EXTERNAL_PG=true and DATABASE_URL is valid', () => {
    const url = 'postgresql://bmt:bmt_secret@127.0.0.1:5432/bmt_db';
    const res = resolveDatabaseMode({
      NODE_ENV: 'test',
      USE_EXTERNAL_PG: 'true',
      DATABASE_URL: url,
    });
    expect(res).toEqual({ mode: 'external', url });
  });

  it('throws clear Thai guidance when USE_EXTERNAL_PG=true but DATABASE_URL is missing', () => {
    expect(() =>
      resolveDatabaseMode({
        NODE_ENV: 'production',
        USE_EXTERNAL_PG: 'true',
      }),
    ).toThrow(/DATABASE_URL/);
  });
});
