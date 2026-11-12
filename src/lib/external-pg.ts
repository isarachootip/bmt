import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const postgresUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
    'DATABASE_URL ต้องขึ้นต้นด้วย postgresql:// หรือ postgres://',
  );

export type DatabaseMode =
  | { mode: 'embedded' }
  | { mode: 'external'; url: string };

function isPlaceholderUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl || !rawUrl.trim()) return true;
  return rawUrl.includes('placeholder:placeholder@127.0.0.1:5432');
}

export function resolveDatabaseMode(
  env: Record<string, string | undefined>,
): DatabaseMode {
  if (env.USE_EXTERNAL_PG === 'false') {
    return { mode: 'embedded' };
  }

  const rawUrl = env.DATABASE_URL?.trim();
  const hasRealUrl = Boolean(rawUrl) && !isPlaceholderUrl(rawUrl);

  if (env.USE_EXTERNAL_PG === 'true') {
    if (!hasRealUrl) {
      throw new Error(
        'เปิดใช้งาน PostgreSQL ภายนอก (USE_EXTERNAL_PG=true) แต่ยังไม่ได้ตั้งค่า DATABASE_URL ใน Environment Variables บน Coolify',
      );
    }
    return { mode: 'external', url: postgresUrlSchema.parse(rawUrl) };
  }

  if (env.NODE_ENV === 'production' && hasRealUrl) {
    return { mode: 'external', url: postgresUrlSchema.parse(rawUrl) };
  }

  return { mode: 'embedded' };
}

export async function initExternalPostgres(url: string): Promise<PrismaClient> {
  process.env.DATABASE_URL = url;
  const prismaCli = path.join(
    process.cwd(),
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );

  try {
    execFileSync(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--schema=prisma/schema'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      },
    );
  } catch (err: unknown) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err && Buffer.isBuffer(err.stderr)
        ? err.stderr.toString('utf8').trim()
        : '';
    throw new Error(
      `ไม่สามารถเชื่อมต่อหรือสร้างตารางบน PostgreSQL ได้: ${stderr || (err instanceof Error ? err.message : 'Unknown error')}`,
    );
  }

  const client = new PrismaClient({ datasources: { db: { url } } });
  await client.$queryRaw`SELECT 1`;
  return client;
}
