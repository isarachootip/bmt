import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDateTime } from '@/lib/timezone';
import { ensureBootstrapped } from '@/services/bootstrap.service';

export async function GET(): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    assertRole(actor, [
      'PAYMENT_OFFICER',
      'APPROVER',
      'FINANCE_MANAGER',
      'ADMIN',
      'AUDITOR',
    ]);

    const events = await prisma.closeJobEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });

    const techMap = new Map(
      (await prisma.technician.findMany()).map((t) => [t.code, t]),
    );

    return NextResponse.json({
      items: events.map((e) => {
        const tech = techMap.get(e.technicianCode);
        return {
          id: e.id,
          receivedAt: formatBangkokDateTime(e.receivedAt),
          bookingNo: e.bookingNo,
          taskCode: e.taskCode,
          jobTitle: e.jobTitle,
          jobType: e.jobType,
          technicianCode: e.technicianCode,
          technicianName: tech?.fullName ?? e.technicianCode,
          technicianStatus: tech?.status ?? 'UNKNOWN',
          amount: Number(e.amount),
          qcStatus: e.qcStatus,
          confirmedBy: e.confirmedBy,
          result: e.result,
          rejectReason: e.rejectReason,
          rawPayload: e.rawPayload,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
