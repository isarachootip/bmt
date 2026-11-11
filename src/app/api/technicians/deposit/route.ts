import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { DepositService } from '@/services/deposit.service';

const depositActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('record'),
    technicianCode: z.string().min(3),
    amount: z.number().positive(),
    evidenceRef: z.string().min(2),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('verify'),
    technicianCode: z.string().min(3),
    note: z.string().optional(),
  }),
]);

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    if (!actor) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' },
        { status: 401 },
      );
    }

    const body = depositActionSchema.parse(await request.json());
    const svc = new DepositService(prisma);

    const updated =
      body.action === 'record'
        ? await svc.recordReceipt({
            technicianCode: body.technicianCode,
            amount: body.amount,
            evidenceRef: body.evidenceRef,
            note: body.note,
            actor,
          })
        : await svc.verifyReceipt({
            technicianCode: body.technicianCode,
            note: body.note,
            actor,
          });

    return NextResponse.json({
      code: updated.code,
      status: updated.status,
      depositStatus: updated.depositStatus,
      depositBalance: Number(updated.depositBalance),
      supplierCode: updated.supplierCode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
