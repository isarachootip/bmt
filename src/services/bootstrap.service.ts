import type { PrismaClient } from '@prisma/client';
import { encryptSensitive } from '@/domain/security/crypto';
import { maskBankAccount, maskTaxId } from '@/domain/security/masking';
import { hashPassword } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { ConfigRepository } from '@/repositories/config.repo';
import { seedSampleJobs } from './bootstrap-jobs';

const STAFF_USERS = [
  { email: 'wanna@company.co.th', fullName: 'วรรณา (Finance)', role: 'PAYMENT_OFFICER' as const },
  { email: 'somporn@company.co.th', fullName: 'สมพร (Approver)', role: 'APPROVER' as const },
  { email: 'teera@company.co.th', fullName: 'ธีระ (Finance Mgr)', role: 'FINANCE_MANAGER' as const },
  { email: 'krit@company.co.th', fullName: 'กฤษณ์ (Admin)', role: 'ADMIN' as const },
  { email: 'auditor@company.co.th', fullName: 'ผู้บริหาร / Auditor', role: 'AUDITOR' as const },
];

const INITIAL_TECHS = [
  { code: 'TC-0102', name: 'สมชาย ใจดี', bank: 'กสิกรไทย', acc: '0452994821', tax: '1100700114821', st: 'ACTIVE' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10102', app: '2026-03-14T09:00:00+07:00' },
  { code: 'TC-0219', name: 'อนุชา รักงาน', bank: 'ไทยพาณิชย์', acc: '4028817702', tax: '1100700227702', st: 'ACTIVE' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10219', app: '2026-06-02T09:00:00+07:00' },
  { code: 'TC-0457', name: 'ธนพล ขยันยิ่ง', bank: 'กรุงเทพ', acc: '1014883304', tax: '1100700333304', st: 'PENDING_DEPOSIT' as const, depSt: 'RECEIVED' as const, dep: 0, sup: null, app: '2026-11-08T09:00:00+07:00' },
  { code: 'TC-0461', name: 'กิตติ พร้อมทำ', bank: 'กรุงไทย', acc: '0981225512', tax: '1100700445512', st: 'PENDING_DEPOSIT' as const, depSt: 'AWAITING' as const, dep: 0, sup: null, app: '2026-11-09T09:00:00+07:00' },
  { code: 'TC-0088', name: 'ประเสริฐ มั่นคง', bank: 'กสิกรไทย', acc: '0129900921', tax: '1100700550921', st: 'ACTIVE' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10088', app: '2026-01-21T09:00:00+07:00' },
  { code: 'TC-0145', name: 'มานพ เลิกงาน', bank: 'ออมสิน', acc: '0203346610', tax: '1100700666610', st: 'OFFBOARDING' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10145', app: '2026-04-11T09:00:00+07:00' },
  { code: 'TC-0312', name: 'สุรชัย ทำจริง', bank: 'กรุงศรี', acc: '3017762290', tax: '1100700772290', st: 'ACTIVE' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10312', app: '2026-07-18T09:00:00+07:00' },
  { code: 'TC-0188', name: 'วิชัย ช่างดี', bank: 'ทหารไทยธนชาต', acc: '2194408145', tax: '1100700888145', st: 'ACTIVE' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10188', app: '2026-05-05T09:00:00+07:00' },
  { code: 'TC-0274', name: 'วีระ ซ่อมไว', bank: 'กสิกรไทย', acc: '0893312044', tax: '1100700992044', st: 'ACTIVE' as const, depSt: 'VERIFIED' as const, dep: 10000, sup: 'SUP-10274', app: '2026-06-20T09:00:00+07:00' },
];

export interface DemoSeedSummary {
  users: number;
  technicians: number;
  jobs: number;
  payables: number;
}

export async function seedDemoDataset(prisma: PrismaClient): Promise<DemoSeedSummary> {
  const cfgRepo = new ConfigRepository(prisma);
  await cfgRepo.getSystemSetting();
  await cfgRepo.ensureDefaultJobRules();

  const pwHash = hashPassword('demo-pass');
  for (const u of STAFF_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash: pwHash },
    });
  }

  const { ENCRYPTION_KEY } = getEnv();
  for (const t of INITIAL_TECHS) {
    const existing = await prisma.technician.findUnique({ where: { code: t.code } });
    if (existing) continue;

    const created = await prisma.technician.create({
      data: {
        code: t.code,
        fullName: t.name,
        status: t.st,
        depositStatus: t.depSt,
        depositBalance: t.dep,
        supplierCode: t.sup,
        bankName: t.bank,
        bankAccountEnc: encryptSensitive(t.acc, ENCRYPTION_KEY),
        bankAccountMask: maskBankAccount(t.bank, t.acc),
        taxIdEnc: encryptSensitive(t.tax, ENCRYPTION_KEY),
        taxIdMask: maskTaxId(t.tax),
        intApprovedAt: new Date(t.app),
        offboardedAt: t.st === 'OFFBOARDING' ? new Date('2026-11-01T10:00:00+07:00') : null,
      },
    });

    await prisma.integrationLog.create({
      data: {
        targetSystem: 'INT',
        direction: 'INBOUND',
        endpoint: 'POST /api/webhooks/int/technician-approved',
        idempotencyKey: `INT-APPROVED-${t.code}`,
        httpStatus: 201,
        requestBody: JSON.stringify({ technicianCode: t.code, fullName: t.name, bankName: t.bank }),
        responseBody: JSON.stringify({ status: 'PENDING_DEPOSIT', code: t.code }),
        success: true,
      },
    });

    if (t.dep > 0) {
      await prisma.depositTransaction.create({
        data: {
          technicianId: created.id,
          kind: 'INITIAL',
          amount: t.dep,
          evidenceRef: `SLIP-${t.code}`,
          verifiedAt: new Date(t.app),
        },
      });
      await prisma.ledgerEntry.create({
        data: {
          technicianId: created.id,
          entryType: 'DEPOSIT_IN',
          referenceCode: `DEP-${t.code}`,
          description: 'รับเงินค้ำประกันช่างแรกเข้า (ยืนยันสลิปแล้ว)',
          amount: t.dep,
          balanceAfter: t.dep,
        },
      });
    } else if (t.depSt === 'RECEIVED') {
      await prisma.depositTransaction.create({
        data: {
          technicianId: created.id,
          kind: 'INITIAL',
          amount: 10000,
          evidenceRef: `SLIP-${t.code}`,
        },
      });
    }
  }

  await seedSampleJobs(prisma);

  const initAuditExists = await prisma.auditLog.findFirst({
    where: { entityRef: 'DEMO-SEED' },
  });
  if (!initAuditExists) {
    await prisma.auditLog.create({
      data: {
        actorName: 'ระบบ',
        actorRole: 'SYSTEM',
        action: 'โหลดข้อมูลตัวอย่าง BMT ครบทุกโมดูล',
        entityRef: 'DEMO-SEED',
        oldValue: null,
        newValue: 'ผู้ใช้งาน 5 บทบาท, ช่าง 9 ราย, งานปิดจ๊อบ 10 งาน, เคลม 2 เคส และประวัติ Oracle/LON',
      },
    });
  }

  const [users, technicians, jobs, payables] = await Promise.all([
    prisma.user.count(),
    prisma.technician.count(),
    prisma.jobPayment.count(),
    prisma.payableItem.count(),
  ]);
  return { users, technicians, jobs, payables };
}

let bootstrapped = false;

export async function ensureBootstrapped(prisma: PrismaClient): Promise<void> {
  if (bootstrapped || process.env.VITEST) return;
  const [userCount, techCount, jobCount] = await Promise.all([
    prisma.user.count(),
    prisma.technician.count(),
    prisma.jobPayment.count(),
  ]);
  if (userCount > 0 && techCount >= INITIAL_TECHS.length && jobCount > 0) {
    bootstrapped = true;
    return;
  }

  await seedDemoDataset(prisma);
  bootstrapped = true;
}
