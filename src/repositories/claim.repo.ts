import type { Prisma, WarrantyClaim } from '@prisma/client';
import type { DbClient } from './audit.repo';

export class ClaimRepository {
  constructor(private readonly db: DbClient) {}

  async findByClaimNo(claimNo: string): Promise<WarrantyClaim | null> {
    return this.db.warrantyClaim.findUnique({ where: { claimNo } });
  }

  async create(data: Prisma.WarrantyClaimCreateInput): Promise<WarrantyClaim> {
    return this.db.warrantyClaim.create({ data });
  }

  async countOpenClaimsForJob(jobPaymentId: string): Promise<number> {
    return this.db.warrantyClaim.count({
      where: { jobPaymentId, status: 'OPEN' },
    });
  }
}
