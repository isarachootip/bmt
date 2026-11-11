import type { AuditLog, Prisma, PrismaClient } from '@prisma/client';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface AppendAuditInput {
  actorName: string;
  actorRole: string;
  actorUserId?: string | null;
  action: string;
  entityRef: string;
  oldValue?: string | null;
  newValue: string;
}

export interface ListAuditFilter {
  query?: string;
  entityRef?: string;
  limit?: number;
}

export class AuditRepository {
  constructor(private readonly db: DbClient) {}

  async append(input: AppendAuditInput): Promise<AuditLog> {
    return this.db.auditLog.create({
      data: {
        actorName: input.actorName,
        actorRole: input.actorRole,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityRef: input.entityRef,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue,
      },
    });
  }

  async list(filter: ListAuditFilter = {}): Promise<AuditLog[]> {
    const q = filter.query?.trim();
    const where: Prisma.AuditLogWhereInput = {};

    if (filter.entityRef) {
      where.entityRef = filter.entityRef;
    }

    if (q) {
      where.OR = [
        { entityRef: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { actorName: { contains: q, mode: 'insensitive' } },
        { newValue: { contains: q, mode: 'insensitive' } },
        { oldValue: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit ?? 200,
    });
  }
}
