'use client';

import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

export interface RetentionItemDto {
  id: string;
  bookingNo: string;
  taskCode: string;
  jobTitle: string;
  technicianCode: string;
  technicianName: string;
  closedDate: string;
  warrantyEndDate: string;
  daysLeft: number;
  stage1Status: string;
  stage2Status: string;
  stage2InitialAmount: number;
  stage2RemainingAmount: number;
  openClaimNo: string | null;
  openClaimReason: string | null;
}

export function RetentionTable({
  items,
  onOpenClaim,
  onSelectResolveClaim,
}: {
  items: RetentionItemDto[];
  onOpenClaim: (item: RetentionItemDto) => void;
  onSelectResolveClaim: (claimNo: string) => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 text-xs">
            <th className="text-left p-3">Booking / Task</th>
            <th className="text-left p-3">ช่าง</th>
            <th className="text-left p-3">งาน</th>
            <th className="text-left p-3">พ้นประกัน</th>
            <th className="text-right p-3">เงิน Hold คงเหลือ</th>
            <th className="text-left p-3">สถานะ</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} className="border-b border-slate-100">
              <td className="p-3 font-mono-code text-xs">
                {j.bookingNo} · {j.taskCode}
              </td>
              <td className="p-3">{j.technicianName}</td>
              <td className="p-3">{j.jobTitle}</td>
              <td className="p-3 text-xs">{j.warrantyEndDate}</td>
              <td className="p-3 text-right font-semibold tabular-nums">
                {formatBaht(j.stage2RemainingAmount)}
              </td>
              <td className="p-3">
                <StatusPill
                  label={j.openClaimNo ? `HOLD · ${j.openClaimNo}` : j.stage2Status}
                  tone={
                    j.stage2Status === 'HOLD'
                      ? 'hold'
                      : j.stage2Status === 'PAID'
                        ? 'ok'
                        : j.stage2Status === 'WAIT_APPROVAL'
                          ? 'sent'
                          : 'grey'
                  }
                />
              </td>
              <td className="p-3 text-right">
                {j.stage2Status === 'RETAINED' ? (
                  <button
                    type="button"
                    onClick={() => onOpenClaim(j)}
                    className="border border-slate-300 px-2.5 py-1 rounded text-xs cursor-pointer hover:bg-slate-50"
                  >
                    เปิดเคลม (จำลอง)
                  </button>
                ) : j.openClaimNo ? (
                  <button
                    type="button"
                    onClick={() => onSelectResolveClaim(j.openClaimNo!)}
                    className="border border-purple-300 bg-purple-50 text-purple-900 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer"
                  >
                    ปิดเคลม {j.openClaimNo}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
