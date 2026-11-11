import type { PrismaClient } from '@prisma/client';
import {
  createEmbeddedPostgresHandle,
  type EmbeddedPgHandle,
} from '@/lib/prisma';

let sharedHandle: EmbeddedPgHandle | undefined;

export async function getTestPrisma(): Promise<PrismaClient> {
  if (!sharedHandle) {
    sharedHandle = await createEmbeddedPostgresHandle('memory://');
    const g = globalThis as unknown as {
      bmtPrisma?: PrismaClient;
      bmtPrismaReady?: Promise<PrismaClient>;
    };
    g.bmtPrisma = sharedHandle.prisma;
    g.bmtPrismaReady = Promise.resolve(sharedHandle.prisma);
  }
  return sharedHandle.prisma;
}

export async function resetTestDatabase(): Promise<void> {
  await getTestPrisma();
  if (!sharedHandle) {
    return;
  }
  await sharedHandle.pglite.exec(`
    TRUNCATE TABLE
      "WarrantyClaim",
      "PayableItem",
      "JobPayment",
      "CloseJobEvent",
      "LedgerEntry",
      "DepositTransaction",
      "Technician",
      "IntegrationLog",
      "AuditLog",
      "JobRuleConfig",
      "SystemSetting",
      "User"
    RESTART IDENTITY CASCADE;
  `);
}
