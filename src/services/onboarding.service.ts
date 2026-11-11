import type { PrismaClient, Technician } from '@prisma/client';
import { encryptSensitive } from '@/domain/security/crypto';
import { maskBankAccount, maskTaxId } from '@/domain/security/masking';
import { getEnv } from '@/lib/env';
import { AuditRepository } from '@/repositories/audit.repo';
import { IntegrationLogRepository } from '@/repositories/integration-log.repo';
import { TechnicianRepository } from '@/repositories/technician.repo';
import {
  intApprovedWebhookSchema,
  type IntApprovedWebhookInput,
} from '@/schemas/technician.schema';

export interface IngestTechnicianResult {
  created: boolean;
  technician: Technician;
}

export class OnboardingService {
  constructor(private readonly prisma: PrismaClient) {}

  async ingestApprovedTechnician(
    rawInput: IntApprovedWebhookInput,
  ): Promise<IngestTechnicianResult> {
    const input = intApprovedWebhookSchema.parse(rawInput);
    const { ENCRYPTION_KEY } = getEnv();

    return this.prisma.$transaction(async (tx) => {
      const techRepo = new TechnicianRepository(tx);
      const auditRepo = new AuditRepository(tx);
      const logRepo = new IntegrationLogRepository(tx);

      const existing = await techRepo.findByCode(input.technicianCode);
      await logRepo.record({
        targetSystem: 'INT',
        direction: 'INBOUND',
        endpoint: 'POST /api/webhooks/int/technician-approved',
        idempotencyKey: input.technicianCode,
        httpStatus: 200,
        requestBody: JSON.stringify({
          technicianCode: input.technicianCode,
          fullName: input.fullName,
          bankName: input.bankName,
        }),
        responseBody: JSON.stringify({ duplicate: Boolean(existing) }),
        success: true,
      });

      if (existing) {
        await auditRepo.append({
          actorName: 'INT Webhook',
          actorRole: 'SYSTEM',
          action: 'รับช่าง Approved ซ้ำ (Idempotent)',
          entityRef: existing.code,
          oldValue: existing.status,
          newValue: `${existing.status} · ไม่สร้างบัญชีซ้ำ`,
        });
        return { created: false, technician: existing };
      }

      const bankAccountEnc = encryptSensitive(input.bankAccountNo, ENCRYPTION_KEY);
      const taxIdEnc = encryptSensitive(input.taxId, ENCRYPTION_KEY);
      const bankAccountMask = maskBankAccount(input.bankName, input.bankAccountNo);
      const taxIdMask = maskTaxId(input.taxId);

      const created = await techRepo.create({
        code: input.technicianCode,
        fullName: input.fullName,
        status: 'PENDING_DEPOSIT',
        depositStatus: 'AWAITING',
        depositBalance: 0,
        outstandingDebt: 0,
        bankName: input.bankName,
        bankAccountEnc,
        bankAccountMask,
        taxIdEnc,
        taxIdMask,
        intApprovedAt: new Date(input.approvedAt),
      });

      await auditRepo.append({
        actorName: 'INT Webhook',
        actorRole: 'SYSTEM',
        action: 'สร้างบัญชีช่างจาก INT',
        entityRef: created.code,
        oldValue: null,
        newValue: `PENDING_DEPOSIT · ${created.fullName} · ${bankAccountMask}`,
      });

      return { created: true, technician: created };
    });
  }
}
