import type { DbTechnicianStatus } from '@prisma/client';
import type { DbClient } from '@/repositories/audit.repo';
import { IntegrationLogRepository } from '@/repositories/integration-log.repo';

export interface IntReadinessPayload {
  technicianCode: string;
  status: DbTechnicianStatus;
  readyForJobs: boolean;
  depositBalance: number;
  reason: string;
}

export class IntSystemAdapter {
  private readonly logRepo: IntegrationLogRepository;

  constructor(db: DbClient) {
    this.logRepo = new IntegrationLogRepository(db);
  }

  async notifyTechnicianReadiness(payload: IntReadinessPayload): Promise<void> {
    const endpoint = 'POST /int/v1/technicians/readiness';
    const responseBody = JSON.stringify({
      acknowledged: true,
      technicianCode: payload.technicianCode,
      readyForJobs: payload.readyForJobs,
    });

    await this.logRepo.record({
      targetSystem: 'INT',
      direction: 'OUTBOUND',
      endpoint,
      idempotencyKey: `INT-READY-${payload.technicianCode}-${payload.status}`,
      httpStatus: 200,
      requestBody: JSON.stringify(payload),
      responseBody,
      attempt: 1,
      success: true,
    });
  }
}
