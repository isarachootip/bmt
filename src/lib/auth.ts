import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getEnv } from './env';
import type { AppUserRole } from '@/schemas/auth.schema';

export interface ActorContext {
  id: string;
  fullName: string;
  role: AppUserRole;
  email?: string;
}

export class AuthorizationError extends Error {
  constructor(message: string = 'ไม่มีสิทธิ์ดำเนินการในคำสั่งนี้') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const SESSION_COOKIE_NAME = 'bmt_session';

export function hashPassword(password: string, salt: string = 'bmt-static-salt-2026'): string {
  return scryptSync(password, salt, 32).toString('hex');
}

export function verifyPassword(password: string, expectedHash: string): boolean {
  const computed = Buffer.from(hashPassword(password), 'hex');
  const target = Buffer.from(expectedHash, 'hex');
  return computed.length === target.length && timingSafeEqual(computed, target);
}

export function signSessionCookie(actor: ActorContext): string {
  const { AUTH_SESSION_SECRET } = getEnv();
  const payload = Buffer.from(JSON.stringify(actor), 'utf8').toString('base64url');
  const sig = createHmac('sha256', AUTH_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionCookie(rawCookie: string | undefined): ActorContext | null {
  if (!rawCookie) return null;
  const parts = rawCookie.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const { AUTH_SESSION_SECRET } = getEnv();
  const expected = createHmac('sha256', AUTH_SESSION_SECRET).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1], 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf8'),
    ) as ActorContext;
    if (!parsed.id || !parsed.role || !parsed.fullName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSessionActor(): Promise<ActorContext | null> {
  const store = await cookies();
  return verifySessionCookie(store.get(SESSION_COOKIE_NAME)?.value);
}

export function assertRole(
  actor: ActorContext | null,
  allowedRoles: readonly AppUserRole[],
): ActorContext {
  if (!actor) {
    throw new AuthorizationError('กรุณาเข้าสู่ระบบก่อนดำเนินการ');
  }
  if (!allowedRoles.includes(actor.role)) {
    throw new AuthorizationError(
      `บทบาท ${actor.role} ไม่มีสิทธิ์ดำเนินการ (ต้องเป็น ${allowedRoles.join(', ')})`,
    );
  }
  return actor;
}
