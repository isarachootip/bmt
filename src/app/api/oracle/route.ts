import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-response';
import { assertRole, getSessionActor } from '@/lib/auth';
import { getPrisma } from '@/lib/prisma';
import { formatBangkokDateTime } from '@/lib/timezone';
import { AuditRepository } from '@/repositories/audit.repo';
import { ApprovalService } from '@/services/approval.service';
import { ensureBootstrapped } from '@/services/bootstrap.service';
import { OracleDispatchService } from '@/services/oracle-dispatch.service';

const oraclePostSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resend'), payableId: z.string().min(3) }),
  z.object({ action: z.literal('reconcile') }),
  z.object({ action: z.literal('sim'), mode: z.enum(['NORMAL', 'FAIL_503']) }),
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
      where: {
        status: { in: ['APPROVED', 'SENT_TO_ORACLE', 'ORACLE_APPROVED', 'PAID', 'SYNC_FAILED'] },
      },
      include: { technician: true },
      orderBy: { updatedAt: 'desc' },
    });

    const attempts = await prisma.integrationLog.findMany({
      where: { targetSystem: 'ORACLE' },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    return NextResponse.json({
      oracleSimMode: setting?.oracleSimMode ?? 'NORMAL',
      items: items.map((i) => ({
        id: i.id,
        idempotencyKey: i.idempotencyKey,
        bookingRef: i.bookingRef,
        kind: i.kind,
        title: i.title,
        supplierCode: i.technician.supplierCode ?? '-',
        technicianName: i.technician.fullName,
        amount: Number(i.amount),
        status: i.status,
        oracleAttempts: i.oracleAttempts,
        oracleDocNo: i.oracleDocNo,
        paidAt: i.paidAt ? formatBangkokDateTime(i.paidAt) : null,
      })),
      attempts: attempts.map((a) => ({
        id: a.id,
        timestamp: formatBangkokDateTime(a.createdAt),
        idempotencyKey: a.idempotencyKey,
        attempt: a.attempt,
        httpStatus: a.httpStatus,
        success: a.success,
        requestBody: a.requestBody,
        responseBody: a.responseBody,
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
      return NextResponse.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    const body = oraclePostSchema.parse(await request.json());

    if (body.action === 'resend') {
      const svc = new ApprovalService(prisma);
      const updated = await svc.resendFailedItem(body.payableId, actor);
      return NextResponse.json({ status: updated.status, oracleDocNo: updated.oracleDocNo });
    }

    if (body.action === 'reconcile') {
      assertRole(actor, ['PAYMENT_OFFICER', 'FINANCE_MANAGER', 'ADMIN']);
      const svc = new OracleDispatchService(prisma);
      const summary = await svc.reconcileDaily();
      return NextResponse.json(summary);
    }

    assertRole(actor, ['ADMIN', 'FINANCE_MANAGER', 'PAYMENT_OFFICER']);
    await prisma.systemSetting.update({
      where: { id: 'singleton' },
      data: { oracleSimMode: body.mode },
    });
    await new AuditRepository(prisma).append({
      actorName: actor.fullName,
      actorRole: actor.role,
      actorUserId: actor.id,
      action: 'สลับโหมดจำลอง Oracle Simulator',
      entityRef: 'ORACLE-SIM',
      oldValue: null,
      newValue: body.mode,
    });
    return NextResponse.json({ oracleSimMode: body.mode });
  } catch (error) {
    return handleApiError(error);
  }
}
