import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { StateTransitionError } from '@/domain/state/technician-state';
import { AuthorizationError } from './auth';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: details || 'ข้อมูลที่ส่งมาไม่ถูกต้อง' },
      { status: 400 },
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: error.message },
      { status: 403 },
    );
  }
  if (error instanceof StateTransitionError) {
    return NextResponse.json(
      { error: 'INVALID_STATE_TRANSITION', message: error.message },
      { status: 409 },
    );
  }
  if (error instanceof Error) {
    return NextResponse.json(
      { error: 'DOMAIN_ERROR', message: error.message },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { error: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
    { status: 500 },
  );
}
