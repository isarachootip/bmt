import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetTestDatabase } from '../helpers/test-db';
import { OnboardingService } from '@/services/onboarding.service';
import { DepositService } from '@/services/deposit.service';
import { AuthorizationError } from '@/lib/auth';

describe('Phase 1: M1 Technician Onboarding & M2 Guarantee Deposit (SOW Test Cases 1-2)', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('SOW TC1: receives INT approved technician idempotently as PENDING_DEPOSIT with encrypted PII', async () => {
    const prisma = await getTestPrisma();
    const onboarding = new OnboardingService(prisma);

    const payload = {
      technicianCode: 'TC-0461',
      fullName: 'กิตติ พร้อมทำ',
      bankName: 'กรุงไทย',
      bankAccountNo: '098-1-25512-9',
      taxId: '1100800995512',
      approvedAt: '2026-11-09T09:30:00+07:00',
    };

    const first = await onboarding.ingestApprovedTechnician(payload);
    expect(first.created).toBe(true);
    expect(first.technician.status).toBe('PENDING_DEPOSIT');
    expect(first.technician.depositStatus).toBe('AWAITING');
    expect(first.technician.bankAccountMask).toBe('กรุงไทย ••• 5129');
    expect(first.technician.taxIdMask).toBe('••• •••• ••5512');
    expect(first.technician.bankAccountEnc).not.toContain('5129');

    // Duplicate webhook with same technicianCode must be idempotent
    const duplicate = await onboarding.ingestApprovedTechnician(payload);
    expect(duplicate.created).toBe(false);
    expect(await prisma.technician.count()).toBe(1);
  });

  it('SOW TC2: records 10,000 THB deposit, enforces RBAC, transitions to ACTIVE, and notifies INT', async () => {
    const prisma = await getTestPrisma();
    const onboarding = new OnboardingService(prisma);
    const depositSvc = new DepositService(prisma);

    await onboarding.ingestApprovedTechnician({
      technicianCode: 'TC-0457',
      fullName: 'ธนพล ขยันยิ่ง',
      bankName: 'กรุงเทพ',
      bankAccountNo: '101-4-83304-0',
      taxId: '1100400223304',
      approvedAt: '2026-11-08T10:00:00+07:00',
    });

    await depositSvc.recordReceipt({
      technicianCode: 'TC-0457',
      amount: 10000,
      evidenceRef: 'SLIP-20261108-001',
      actor: { id: 'usr-wanna', fullName: 'วรรณา (Finance)', role: 'PAYMENT_OFFICER' },
    });

    // Auditor must not be allowed to verify deposits
    await expect(
      depositSvc.verifyReceipt({
        technicianCode: 'TC-0457',
        actor: { id: 'usr-exec', fullName: 'ผู้บริหาร', role: 'AUDITOR' },
      }),
    ).rejects.toThrow(AuthorizationError);

    // Finance / Payment Officer verifies deposit -> ACTIVE + Supplier + INT Outbound Log
    const verified = await depositSvc.verifyReceipt({
      technicianCode: 'TC-0457',
      actor: { id: 'usr-wanna', fullName: 'วรรณา (Finance)', role: 'PAYMENT_OFFICER' },
    });

    expect(verified.status).toBe('ACTIVE');
    expect(verified.depositStatus).toBe('VERIFIED');
    expect(Number(verified.depositBalance)).toBe(10000);
    expect(verified.supplierCode).toBe('SUP-10457');

    const intOutbound = await prisma.integrationLog.findMany({
      where: { targetSystem: 'INT', direction: 'OUTBOUND' },
    });
    expect(intOutbound).toHaveLength(1);
    expect(intOutbound[0]?.requestBody).toContain('"readyForJobs":true');

    const audits = await prisma.auditLog.findMany({
      where: { entityRef: 'TC-0457' },
    });
    expect(audits.length).toBeGreaterThanOrEqual(3);
  });
});
