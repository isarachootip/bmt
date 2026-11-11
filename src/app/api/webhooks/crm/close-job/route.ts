import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { getPrisma } from '@/lib/prisma';
import { closeJobWebhookSchema } from '@/schemas/close-job.schema';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { CloseJobService } from '@/services/close-job.service';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const body = closeJobWebhookSchema.parse(await request.json());
    const svc = new CloseJobService(prisma);
    const result = await svc.ingestCloseJob(body);

    const status =
      result.outcome === 'REJECTED'
        ? 422
        : result.outcome === 'ACCEPTED'
          ? 201
          : 200;

    return NextResponse.json(
      {
        outcome: result.outcome,
        rejectReason: result.rejectReason,
        eventId: result.event.id,
        jobPaymentId: result.jobPayment?.id ?? null,
      },
      { status },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
