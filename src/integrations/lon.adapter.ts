import { createStatementToken } from '@/domain/security/statement-token';
import { getEnv } from '@/lib/env';
import type { DbClient } from '@/repositories/audit.repo';
import { IntegrationLogRepository } from '@/repositories/integration-log.repo';

export interface LineNotifyInput {
  technicianCode: string;
  technicianName: string;
  message: string;
  reference: string;
}

export class LineOaAdapter {
  private readonly logRepo: IntegrationLogRepository;

  constructor(db: DbClient) {
    this.logRepo = new IntegrationLogRepository(db);
  }

  async pushTechnicianNotification(input: LineNotifyInput): Promise<string> {
    const { STATEMENT_SIGNING_SECRET, NEXT_PUBLIC_APP_URL } = getEnv();
    const token = createStatementToken(input.technicianCode, STATEMENT_SIGNING_SECRET);
    const statementUrl = `${NEXT_PUBLIC_APP_URL}/statement/${token}`;

    const payload = {
      toTechnician: input.technicianCode,
      recipientName: input.technicianName,
      message: input.message,
      statementUrl,
      reference: input.reference,
    };

    await this.logRepo.record({
      targetSystem: 'LON',
      direction: 'OUTBOUND',
      endpoint: 'POST /lon/v1/line-oa/push',
      idempotencyKey: `LON-${input.technicianCode}-${input.reference}`,
      httpStatus: 200,
      requestBody: JSON.stringify(payload),
      responseBody: JSON.stringify({ delivered: true }),
      attempt: 1,
      success: true,
    });

    return statementUrl;
  }
}
