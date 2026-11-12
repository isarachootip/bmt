import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { seedDemoDataset } from '@/services/bootstrap.service';

export async function POST(): Promise<NextResponse> {
  try {
    const actor = assertRole(await getSessionActor(), [
      'PAYMENT_OFFICER',
      'APPROVER',
      'FINANCE_MANAGER',
      'ADMIN',
    ]);
    const prisma = await getPrisma();
    const summary = await seedDemoDataset(prisma);
    return NextResponse.json({
      seeded: true,
      requestedBy: actor.fullName,
      ...summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
