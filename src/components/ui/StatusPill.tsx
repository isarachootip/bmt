export type PillTone = 'ok' | 'wait' | 'sent' | 'fail' | 'hold' | 'grey';

const TONE_CLASSES: Record<PillTone, string> = {
  ok: 'bg-green-100 text-green-800',
  wait: 'bg-amber-100 text-amber-800',
  sent: 'bg-blue-100 text-blue-800',
  fail: 'bg-red-100 text-red-800',
  hold: 'bg-purple-100 text-purple-800',
  grey: 'bg-slate-100 text-slate-700',
};

export function StatusPill({
  label,
  tone = 'grey',
}: {
  label: string;
  tone?: PillTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

export function mapTechStatusBadge(
  status: string,
  depositStatus: string,
): { label: string; tone: PillTone } {
  if (status === 'ACTIVE') return { label: 'ACTIVE', tone: 'ok' };
  if (status === 'SUSPENDED') return { label: 'SUSPENDED · ค้ำประกันต่ำกว่าเกณฑ์', tone: 'fail' };
  if (status === 'OFFBOARDING') return { label: 'OFFBOARDING · รอคืนเงิน', tone: 'grey' };
  if (status === 'CLOSED') return { label: 'CLOSED · คืนเงินแล้ว', tone: 'grey' };
  if (depositStatus === 'RECEIVED' || depositStatus === 'TOPUP_RECEIVED') {
    return { label: 'รอ Finance ยืนยัน', tone: 'sent' };
  }
  return { label: 'รอวางเงินค้ำประกัน', tone: 'wait' };
}

export function formatBaht(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
