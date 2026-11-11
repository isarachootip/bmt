import type {
  CloseJobEvent,
  JobPayment,
  PayableItem,
  Prisma,
} from '@prisma/client';
import type { DbClient } from './audit.repo';

export class JobPaymentRepository {
  constructor(private readonly db: DbClient) {}

  async findJobByBookingAndTask(
    bookingNo: string,
    taskCode: string,
  ): Promise<JobPayment | null> {
    return this.db.jobPayment.findUnique({
      where: { bookingNo_taskCode: { bookingNo, taskCode } },
    });
  }

  async recordIntakeEvent(
    data: Prisma.CloseJobEventCreateInput,
  ): Promise<CloseJobEvent> {
    return this.db.closeJobEvent.create({ data });
  }

  async findEventById(id: string): Promise<CloseJobEvent | null> {
    return this.db.closeJobEvent.findUnique({ where: { id } });
  }

  async listRecentEvents(limit: number = 100): Promise<CloseJobEvent[]> {
    return this.db.closeJobEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  async createJobPayment(data: Prisma.JobPaymentCreateInput): Promise<JobPayment> {
    return this.db.jobPayment.create({ data });
  }

  async createPayableItem(data: Prisma.PayableItemCreateInput): Promise<PayableItem> {
    return this.db.payableItem.create({ data });
  }

  async listJobsByTechnicianId(technicianId: string): Promise<JobPayment[]> {
    return this.db.jobPayment.findMany({
      where: { technicianId },
      include: { claims: true },
      orderBy: { closedAt: 'desc' },
    });
  }
}
