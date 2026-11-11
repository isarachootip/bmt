import { describe, expect, it } from 'vitest';
import {
  addBangkokDays,
  formatBangkokDate,
  formatBangkokDateTime,
  isWarrantyExpired,
} from '@/lib/timezone';

describe('Asia/Bangkok Timezone & Date Formatting', () => {
  it('formats UTC timestamp into DD/MM/YYYY HH:mm น. in Asia/Bangkok (+07:00)', () => {
    const utcDate = new Date('2026-11-10T03:02:15.000Z'); // 10:02 in Bangkok
    expect(formatBangkokDateTime(utcDate)).toBe('10/11/2026 10:02 น.');
    expect(formatBangkokDate(utcDate)).toBe('10/11/2026');
  });

  it('adds calendar warranty days accurately in Asia/Bangkok', () => {
    const closedAt = new Date('2026-11-10T10:24:00+07:00');
    const qWarrantyEnd = addBangkokDays(closedAt, 30);
    const rWarrantyEnd = addBangkokDays(closedAt, 90);

    expect(formatBangkokDate(qWarrantyEnd)).toBe('10/12/2026');
    expect(formatBangkokDate(rWarrantyEnd)).toBe('08/02/2027');
  });

  it('evaluates warranty expiration on Bangkok calendar day boundary', () => {
    const warrantyEnd = new Date('2026-12-10T00:00:00+07:00');
    expect(isWarrantyExpired(warrantyEnd, new Date('2026-12-09T23:59:59+07:00'))).toBe(false);
    expect(isWarrantyExpired(warrantyEnd, new Date('2026-12-10T06:00:00+07:00'))).toBe(true);
  });
});
