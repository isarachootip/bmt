import { createHmac, timingSafeEqual } from 'node:crypto';

export type VerifiedStatementToken =
  | { valid: true; technicianCode: string }
  | { valid: false; reason: string };

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createStatementToken(
  technicianCode: string,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = 7 * 24 * 3600,
): string {
  const expMs = nowMs + ttlSeconds * 1000;
  const encodedCode = Buffer.from(technicianCode, 'utf8').toString('base64url');
  const body = `${encodedCode}.${expMs}`;
  const sig = signPayload(body, secret);
  return `${body}.${sig}`;
}

export function verifyStatementToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): VerifiedStatementToken {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'INVALID_TOKEN_FORMAT' };
  }
  const [encodedCode, expStr, providedSig] = parts;
  if (!encodedCode || !expStr || !providedSig) {
    return { valid: false, reason: 'EMPTY_TOKEN_SEGMENT' };
  }
  const body = `${encodedCode}.${expStr}`;
  const expectedSig = signPayload(body, secret);

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  const expMs = Number(expStr);
  if (!Number.isFinite(expMs) || nowMs > expMs) {
    return { valid: false, reason: 'TOKEN_EXPIRED' };
  }

  const technicianCode = Buffer.from(encodedCode, 'base64url').toString('utf8');
  if (!technicianCode) {
    return { valid: false, reason: 'EMPTY_TECHNICIAN_CODE' };
  }
  return { valid: true, technicianCode };
}
