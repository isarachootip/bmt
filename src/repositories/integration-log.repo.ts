import type {
  ExternalSystem,
  IntegrationDirection,
  IntegrationLog,
} from '@prisma/client';
import type { DbClient } from './audit.repo';

export interface CreateIntegrationLogInput {
  targetSystem: ExternalSystem;
  direction: IntegrationDirection;
  endpoint: string;
  idempotencyKey?: string | null;
  httpStatus: number;
  requestBody: string;
  responseBody: string;
  attempt?: number;
  success: boolean;
}

export class IntegrationLogRepository {
  constructor(private readonly db: DbClient) {}

  async record(input: CreateIntegrationLogInput): Promise<IntegrationLog> {
    return this.db.integrationLog.create({
      data: {
        targetSystem: input.targetSystem,
        direction: input.direction,
        endpoint: input.endpoint,
        idempotencyKey: input.idempotencyKey ?? null,
        httpStatus: input.httpStatus,
        requestBody: input.requestBody,
        responseBody: input.responseBody,
        attempt: input.attempt ?? 1,
        success: input.success,
      },
    });
  }

  async listByTarget(targetSystem?: ExternalSystem, limit: number = 100): Promise<IntegrationLog[]> {
    return this.db.integrationLog.findMany({
      where: targetSystem ? { targetSystem } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
