import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '@/lib/auth';
import { seedDemoDataset } from '@/services/bootstrap.service';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';

describe('Demo Dataset Seeding & Partial-Bootstrap Self-Healing', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('populates full demo dataset even when User rows already exist (Coolify partial bootstrap recovery) and is idempotent', async () => {
    const prisma = await getTestPrisma();

    // Simulate interrupted first boot where staff User already existed
    await prisma.user.create({
      data: {
        email: 'wanna@company.co.th',
        fullName: 'วรรณา (Finance)',
        role: 'PAYMENT_OFFICER',
        passwordHash: hashPassword('demo-pass'),
      },
    });
    expect(await prisma.technician.count()).toBe(0);

    const summary1 = await seedDemoDataset(prisma);
    expect(summary1.technicians).toBeGreaterThanOrEqual(9);
    expect(summary1.jobs).toBeGreaterThanOrEqual(9);
    expect(summary1.payables).toBeGreaterThanOrEqual(8);

    // Verify all showcase states exist across modules
    const suspended = await prisma.technician.findUnique({ where: { code: 'TC-0274' } });
    expect(suspended?.status).toBe('SUSPENDED');
    expect(Number(suspended?.depositBalance)).toBe(6500);

    const oracleLogs = await prisma.integrationLog.count({ where: { targetSystem: 'ORACLE' } });
    const lonLogs = await prisma.integrationLog.count({ where: { targetSystem: 'LON' } });
    expect(oracleLogs).toBeGreaterThanOrEqual(2);
    expect(lonLogs).toBeGreaterThanOrEqual(1);

    const openClaims = await prisma.warrantyClaim.count({ where: { status: 'OPEN' } });
    const closedClaims = await prisma.warrantyClaim.count({ where: { status: 'CLOSED_DEDUCTED' } });
    expect(openClaims).toBeGreaterThanOrEqual(1);
    expect(closedClaims).toBeGreaterThanOrEqual(1);

    // Calling a second time must be 100% idempotent (no duplicates, no errors)
    const summary2 = await seedDemoDataset(prisma);
    expect(summary2.technicians).toBe(summary1.technicians);
    expect(summary2.jobs).toBe(summary1.jobs);
  });
});
