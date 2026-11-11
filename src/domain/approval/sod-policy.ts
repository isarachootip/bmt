import { AuthorizationError, type ActorContext } from '@/lib/auth';

export class SegregationOfDutiesError extends Error {
  constructor(
    message: string = 'ผู้สร้างหรือแก้ไขรายการไม่สามารถอนุมัติรายการของตนเองได้ (Segregation of Duties)',
  ) {
    super(message);
    this.name = 'SegregationOfDutiesError';
  }
}

export interface ApprovalPermissionInput {
  actor: ActorContext;
  decision: 'APPROVE' | 'REJECT';
  note?: string;
  batchTotalAmount: number;
  approverLimit: number;
  creatorUserIds: ReadonlyArray<string | null | undefined>;
}

export function assertApprovalPermission(input: ApprovalPermissionInput): void {
  const { actor, decision, note, batchTotalAmount, approverLimit, creatorUserIds } =
    input;

  if (actor.role !== 'APPROVER' && actor.role !== 'FINANCE_MANAGER') {
    throw new AuthorizationError(
      `บทบาท ${actor.role} ไม่มีสิทธิ์อนุมัติหรือปฏิเสธรายการจ่าย (ต้องเป็น APPROVER หรือ FINANCE_MANAGER)`,
    );
  }

  if (creatorUserIds.some((creatorId) => creatorId && creatorId === actor.id)) {
    throw new SegregationOfDutiesError();
  }

  if (decision === 'REJECT' && (!note || !note.trim())) {
    throw new Error('กรุณาระบุเหตุผลประกอบการปฏิเสธรายการจ่าย');
  }

  if (
    decision === 'APPROVE' &&
    actor.role === 'APPROVER' &&
    batchTotalAmount > approverLimit
  ) {
    throw new AuthorizationError(
      `ยอดอนุมัติรวม ฿${batchTotalAmount.toFixed(2)} เกินวงเงินของ Approver (฿${approverLimit.toFixed(2)}) กรุณาส่งต่อให้ Finance Manager อนุมัติ`,
    );
  }
}
