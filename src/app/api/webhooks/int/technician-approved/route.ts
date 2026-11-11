import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { getPrisma } from '@/lib/prisma';
import { intApprovedWebhookSchema } from '@/schemas/technician.schema';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { OnboardingService } from '@/services/onboarding.service';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const body = intApprovedWebhookSchema.parse(await request.json());
    const service = new OnboardingService(prisma);
    const result = await service.ingestApprovedTechnician(body);

    return NextResponse.json(
      {
        created: result.created,
        technician: {
          code: result.technician.code,
          fullName: result.technician.fullName,
          status: result.technician.status,
          depositStatus: result.technician.depositStatus,
          bankAccountMask: result.technician.bankAccountMask,
        },
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
