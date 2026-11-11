import type {
  DbDepositStatus,
  DbTechnicianStatus,
  Prisma,
  Technician,
} from '@prisma/client';
import type { DbClient } from './audit.repo';

export class TechnicianRepository {
  constructor(private readonly db: DbClient) {}

  async findByCode(code: string): Promise<Technician | null> {
    return this.db.technician.findUnique({ where: { code } });
  }

  async findById(id: string): Promise<Technician | null> {
    return this.db.technician.findUnique({ where: { id } });
  }

  async list(statusFilter?: DbTechnicianStatus): Promise<Technician[]> {
    return this.db.technician.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
    });
  }

  async create(data: Prisma.TechnicianCreateInput): Promise<Technician> {
    return this.db.technician.create({ data });
  }

  async updateBalancesAndState(
    id: string,
    data: {
      status?: DbTechnicianStatus;
      depositStatus?: DbDepositStatus;
      depositBalance?: Prisma.Decimal | number;
      outstandingDebt?: Prisma.Decimal | number;
      supplierCode?: string | null;
      offboardedAt?: Date | null;
    },
  ): Promise<Technician> {
    return this.db.technician.update({
      where: { id },
      data,
    });
  }
}
