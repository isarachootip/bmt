import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { ReportService } from '@/services/report.service';

export async function GET(request: Request): Promise<NextResponse> {
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

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') ?? 'dashboard';
    const service = new ReportService(prisma);

    if (mode === 'reports') {
      const data = await service.getReportsData();
      return NextResponse.json(data);
    }

    const summary = await service.getDashboardSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
