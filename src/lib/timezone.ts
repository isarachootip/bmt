const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toBangkokShiftedUtc(date: Date): Date {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS);
}

export function formatBangkokDate(date: Date): string {
  const shifted = toBangkokShiftedUtc(date);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = shifted.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatBangkokDateTime(date: Date): string {
  const shifted = toBangkokShiftedUtc(date);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = shifted.getUTCFullYear();
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const min = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min} น.`;
}

export function startOfBangkokDay(date: Date): Date {
  const shifted = toBangkokShiftedUtc(date);
  const midnightShiftedMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return new Date(midnightShiftedMs - BANGKOK_OFFSET_MS);
}

export function addBangkokDays(date: Date, days: number): Date {
  const start = startOfBangkokDay(date);
  return new Date(start.getTime() + days * DAY_MS);
}

export function isWarrantyExpired(warrantyEndDate: Date, referenceNow: Date): boolean {
  const endDay = startOfBangkokDay(warrantyEndDate).getTime();
  const currentDay = startOfBangkokDay(referenceNow).getTime();
  return currentDay >= endDay;
}
