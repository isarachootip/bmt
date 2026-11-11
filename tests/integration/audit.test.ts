import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';
import { AuditRepository } from '@/repositories/audit.repo';

describe('Immutable Audit Log Repository & PostgreSQL Trigger (M10)', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('appends audit entries with old -> new values and searches by entityRef or keyword', async () => {
    const prisma = await getTestPrisma();
    const repo = new AuditRepository(prisma);

    await repo.append({
      actorName: 'วรรณา (Finance)',
      actorRole: 'PAYMENT_OFFICER',
      actorUserId: 'usr-wanna',
      action: 'ยืนยันรับเงินค้ำประกัน',
      entityRef: 'TC-0102',
      oldValue: 'PENDING_DEPOSIT',
      newValue: 'ACTIVE · ฿10,000.00',
    });

    await repo.append({
      actorName: 'ระบบ',
      actorRole: 'SYSTEM',
      action: 'คำนวณงวด 90/10',
      entityRef: 'BK-2611-00418',
      oldValue: null,
      newValue: 'ค่างาน 2,000.00 -> งวดแรก 1,800.00 · hold 200.00',
    });

    const all = await repo.list({});
    expect(all).toHaveLength(2);
    expect(all[0]?.entityRef).toBe('BK-2611-00418');

    const filtered = await repo.list({ query: 'TC-0102' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.actorName).toBe('วรรณา (Finance)');
  });

  it('rejects UPDATE and DELETE at the PostgreSQL database level (immutability guarantee)', async () => {
    const prisma = await getTestPrisma();
    const repo = new AuditRepository(prisma);

    const created = await repo.append({
      actorName: 'สมพร (Approver)',
      actorRole: 'APPROVER',
      action: 'อนุมัติงวดแรก',
      entityRef: 'BK-2611-00418',
      oldValue: 'WAIT_APPROVAL',
      newValue: 'APPROVED',
    });

    // Repository surface has no update or delete methods
    expect('update' in repo).toBe(false);
    expect('delete' in repo).toBe(false);

    // Even direct Prisma / SQL mutation on AuditLog must fail due to PostgreSQL trigger
    await expect(
      prisma.auditLog.delete({ where: { id: created.id } }),
    ).rejects.toThrow();

    await expect(
      prisma.auditLog.update({
        where: { id: created.id },
        data: { newValue: 'TAMPERED' },
      }),
    ).rejects.toThrow();
  });
});
