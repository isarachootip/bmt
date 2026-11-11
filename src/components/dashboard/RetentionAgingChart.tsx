import { formatBaht } from '@/components/ui/StatusPill';

export interface AgingBucketDto {
  month: string;
  amount: number;
}

export interface DepositSummaryDto {
  totalDepositHeld: number;
  activeCount: number;
  pendingCount: number;
  suspendedCount: number;
  offboardingCount: number;
}

export function RetentionAgingChart({
  buckets,
  depositSummary,
}: {
  buckets: AgingBucketDto[];
  depositSummary: DepositSummaryDto;
}) {
  const maxVal = Math.max(1, ...buckets.map((b) => b.amount));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            กำหนดปล่อยเงิน Hold รายเดือน (Aging)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ยอดเงินประกันผลงาน 10% แยกตามเดือนที่ครบกำหนดรับประกัน (Q=30 วัน · R/MA=90 วัน)
          </p>
        </div>

        {buckets.length === 0 ? (
          <div className="text-sm text-slate-400 py-8 text-center">
            ไม่มีรายการเงิน Hold คงค้างในขณะนี้
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {buckets.map((bucket) => {
              const widthPct = Math.max(8, Math.round((bucket.amount / maxVal) * 100));
              return (
                <div key={bucket.month} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span className="font-mono-code">{bucket.month}</span>
                    <span className="font-mono-code font-semibold text-slate-900">
                      {formatBaht(bucket.amount)} ฿
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            ภาพรวมเงินค้ำประกันและสถานะบัญชีช่าง
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เกณฑ์ขั้นต่ำ 10,000.00 บาทต่อราย หากต่ำกว่าเกณฑ์จะถูกระงับรับงาน (SUSPENDED) อัตโนมัติ
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-600">เงินค้ำประกันถือครองรวม</span>
          <span className="text-2xl font-bold text-slate-900 font-mono-code">
            {formatBaht(depositSummary.totalDepositHeld)} ฿
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-xl font-bold text-emerald-800">{depositSummary.activeCount}</div>
            <div className="text-xs text-emerald-700 font-medium">ACTIVE</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="text-xl font-bold text-amber-800">{depositSummary.pendingCount}</div>
            <div className="text-xs text-amber-700 font-medium">รอค้ำประกัน</div>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
            <div className="text-xl font-bold text-rose-800">{depositSummary.suspendedCount}</div>
            <div className="text-xs text-rose-700 font-medium">SUSPENDED</div>
          </div>
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-3">
            <div className="text-xl font-bold text-slate-700">
              {depositSummary.offboardingCount}
            </div>
            <div className="text-xs text-slate-600 font-medium">OFFBOARDING</div>
          </div>
        </div>
      </section>
    </div>
  );
}
