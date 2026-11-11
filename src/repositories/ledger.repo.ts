import type {
  DepositTransaction,
  DepositTxKind,
  LedgerEntry,
  LedgerEntryType,
} from '@prisma/client';
import type { DbClient } from './audit.repo';

export interface CreateDepositTxInput {
  technicianId: string;
  kind: DepositTxKind;
  amount: number;
  evidenceRef?: string | null;
  recordedById?: string | null;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  note?: string | null;
}

export interface AppendLedgerInput {
  technicianId: string;
  entryType: LedgerEntryType;
  referenceCode: string;
  description: string;
  amount: number;
  balanceAfter: number;
}

export class DepositLedgerRepository {
  constructor(private readonly db: DbClient) {}

  async createDepositTx(input: CreateDepositTxInput): Promise<DepositTransaction> {
    return this.db.depositTransaction.create({
      data: {
        technicianId: input.technicianId,
        kind: input.kind,
        amount: input.amount,
        evidenceRef: input.evidenceRef ?? null,
        recordedById: input.recordedById ?? null,
        verifiedById: input.verifiedById ?? null,
        verifiedAt: input.verifiedAt ?? null,
        note: input.note ?? null,
      },
    });
  }

  async findLatestUnverifiedDeposit(technicianId: string): Promise<DepositTransaction | null> {
    return this.db.depositTransaction.findFirst({
      where: {
        technicianId,
        kind: { in: ['INITIAL', 'TOPUP'] },
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markDepositVerified(txId: string, verifiedById: string): Promise<DepositTransaction> {
    return this.db.depositTransaction.update({
      where: { id: txId },
      data: { verifiedById, verifiedAt: new Date() },
    });
  }

  async appendLedger(input: AppendLedgerInput): Promise<LedgerEntry> {
    return this.db.ledgerEntry.create({
      data: {
        technicianId: input.technicianId,
        entryType: input.entryType,
        referenceCode: input.referenceCode,
        description: input.description,
        amount: input.amount,
        balanceAfter: input.balanceAfter,
      },
    });
  }
}
