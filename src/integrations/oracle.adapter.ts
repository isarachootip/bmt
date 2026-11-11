import type { DbClient } from '@/repositories/audit.repo';
import { IntegrationLogRepository } from '@/repositories/integration-log.repo';

export interface OraclePaymentRequestPayload {
  idempotencyKey: string;
  supplierCode: string;
  amount: number;
  currency: 'THB';
  reference: string;
}

export interface OracleDispatchResult {
  success: boolean;
  attempts: number;
  oracleDocNo?: string;
  lastHttpStatus: number;
  errorMessage?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OracleFinancialsAdapter {
  private readonly logRepo: IntegrationLogRepository;

  constructor(db: DbClient) {
    this.logRepo = new IntegrationLogRepository(db);
  }

  async sendPaymentRequestWithRetry(
    payload: OraclePaymentRequestPayload,
    simMode: string,
    maxRetries: number = 3,
  ): Promise<OracleDispatchResult> {
    const endpoint = 'POST /oracle/ap/payment-requests';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) {
        await sleep(attempt * 15); // Exponential/linear fast backoff in ms
      }

      if (simMode === 'FAIL_503') {
        const httpStatus = attempt < maxRetries ? 504 : 503;
        const errBody = JSON.stringify({
          error: httpStatus === 504 ? 'gateway timeout' : 'service unavailable',
        });
        await this.logRepo.record({
          targetSystem: 'ORACLE',
          direction: 'OUTBOUND',
          endpoint,
          idempotencyKey: payload.idempotencyKey,
          httpStatus,
          requestBody: JSON.stringify(payload),
          responseBody: errBody,
          attempt,
          success: false,
        });
        if (attempt === maxRetries) {
          return {
            success: false,
            attempts: attempt,
            lastHttpStatus: httpStatus,
            errorMessage: `HTTP ${httpStatus}`,
          };
        }
        continue;
      }

      const suffix = payload.idempotencyKey.slice(-6).toUpperCase();
      const oracleDocNo = `ORA-AP-${suffix}-${Date.now().toString().slice(-4)}`;
      const okBody = JSON.stringify({
        oracle_doc_no: oracleDocNo,
        status: 'PAID',
        wht_handled_by_oracle: true,
      });

      await this.logRepo.record({
        targetSystem: 'ORACLE',
        direction: 'OUTBOUND',
        endpoint,
        idempotencyKey: payload.idempotencyKey,
        httpStatus: 201,
        requestBody: JSON.stringify(payload),
        responseBody: okBody,
        attempt,
        success: true,
      });

      return {
        success: true,
        attempts: attempt,
        oracleDocNo,
        lastHttpStatus: 201,
      };
    }

    return { success: false, attempts: maxRetries, lastHttpStatus: 503 };
  }
}
