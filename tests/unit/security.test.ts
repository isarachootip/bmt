import { describe, expect, it } from 'vitest';
import { decryptSensitive, encryptSensitive } from '@/domain/security/crypto';
import { maskBankAccount, maskTaxId } from '@/domain/security/masking';
import {
  createStatementToken,
  verifyStatementToken,
} from '@/domain/security/statement-token';

const TEST_HEX_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const SIGNING_SECRET = 'test-statement-signing-secret-2026';

describe('Security Domain: AES-256-GCM, Masking & Signed Statement Tokens', () => {
  it('encrypts with random IV so ciphertexts differ and decrypts back identically', () => {
    const rawAccount = '045-2-99482-1';
    const c1 = encryptSensitive(rawAccount, TEST_HEX_KEY);
    const c2 = encryptSensitive(rawAccount, TEST_HEX_KEY);

    expect(c1).not.toBe(rawAccount);
    expect(c1).not.toBe(c2);
    expect(decryptSensitive(c1, TEST_HEX_KEY)).toBe(rawAccount);
    expect(decryptSensitive(c2, TEST_HEX_KEY)).toBe(rawAccount);
  });

  it('rejects tampered AES-256-GCM ciphertext', () => {
    const cipher = encryptSensitive('1100700123456', TEST_HEX_KEY);
    const tampered = `${cipher.slice(0, -2)}ff`;
    expect(() => decryptSensitive(tampered, TEST_HEX_KEY)).toThrow();
  });

  it('masks bank account and tax ID keeping only last 4 digits', () => {
    expect(maskBankAccount('กสิกรไทย', '045-2-99482-1')).toBe('กสิกรไทย ••• 4821');
    expect(maskTaxId('1100700123456')).toBe('••• •••• ••3456');
  });

  it('signs and verifies technician-bound statement tokens and blocks tampering', () => {
    const nowMs = Date.UTC(2026, 10, 10, 3, 0, 0);
    const token = createStatementToken('TC-0102', SIGNING_SECRET, nowMs, 3600);

    const verified = verifyStatementToken(token, SIGNING_SECRET, nowMs + 60_000);
    expect(verified).toEqual({ valid: true, technicianCode: 'TC-0102' });

    const expired = verifyStatementToken(token, SIGNING_SECRET, nowMs + 4000_000);
    expect(expired.valid).toBe(false);

    const [, expPart, sigPart] = token.split('.');
    const forged = `${Buffer.from('TC-0219', 'utf8').toString('base64url')}.${expPart}.${sigPart}`;
    expect(verifyStatementToken(forged, SIGNING_SECRET, nowMs).valid).toBe(false);
  });
});
