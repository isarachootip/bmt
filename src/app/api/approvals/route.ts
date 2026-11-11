import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDate } from '@/lib/timezone';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { ApprovalService } from '@/services/approval.service';

const approvalActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('decide'),
    payableIds: z.array(z.string().min(3)).min(1),
    decision: z.enum(['APPROVE', 'REJECT']),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('adjustment'),
    technicianCode: z.string().min(3),
    bookingRef: z.string().min(3),
    title: z.string().min(3),
    amount: z.number().positive(),
  }),
]);

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

    const setting = await prisma.systemSetting.findUnique({ where: { id: 'singleton' } });
    const items = await prisma.payableItem.findMany({
      where: { status: 'WAIT_APPROVAL' },
      include: { technician: true, jobPayment: true },
      orderBy: { createdAt: 'desc' },
    });
    const failedCount = await prisma.payableItem.count({
      where: { status: 'SYNC_FAILED' },
    });

    return NextResponse.json({
      approverLimit: Number(setting?.approverLimit ?? 50000),
      failedCount,
      items: items.map((i) => ({
        id: i.id,
        idempotencyKey: i.idempotencyKey,
        kind: i.kind,
        bookingRef: i.bookingRef,
        title: i.title,
        amount: Number(i.amount),
        status: i.status,
        createdByUserId: i.createdByUserId,
        technicianCode: i.technician.code,
        technicianName: i.technician.fullName,
        supplierCode: i.technician.supplierCode ?? 'รอสร้าง',
        totalJobAmount: i.jobPayment ? Number(i.jobPayment.totalAmount) : Number(i.amount),
        stage1Amount: i.jobPayment ? Number(i.jobPayment.stage1Amount) : Number(i.amount),
        stage2Amount: i.jobPayment ? Number(i.jobPayment.stage2RemainingAmount) : 0,
        stage1Pct: i.jobPayment ? Number(i.jobPayment.snapshotStage1Pct) : 100,
        stage2Pct: i.jobPayment ? Number(i.jobPayment.snapshotStage2Pct) : 0,
        closedDate: i.jobPayment ? formatBangkokDate(i.jobPayment.closedAt) : '-',
        warrantyEndDate: i.jobPayment ? formatBangkokDate(i.jobPayment.warrantyEndAt) : '-',
        confirmedBy: i.jobPayment?.confirmedByCustSat ?? 'Finance',
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const prisma = await getPrisma();
    await ensureBootstrapped(prisma);
    const actor = await getSessionActor();
    if (!actor) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 },
      );
    }

    const body = approvalActionSchema.parse(await request.json());
    const svc = new ApprovalService(prisma);

    if (body.action === 'adjustment') {
      const created = await svc.createAdjustmentPayable({ ...body, actor });
      return NextResponse.json({ id: created.id }, { status: 201 });
    }

    const result = await svc.decideBatch({
      payableIds: body.payableIds,
      decision: body.decision,
      note: body.note,
      actor,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
