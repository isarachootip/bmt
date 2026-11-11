'use client';

import type { ApprovalItemDto } from './ApprovalDetailPane';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

export function ApprovalTable({
  items,
  selectedId,
  checked,
  approverLimit,
  busy,
  onSelect,
  onToggleCheck,
  onToggleAll,
  onApproveChosen,
}: {
  items: ApprovalItemDto[];
  selectedId: string | undefined;
  checked: Record<string, boolean>;
  approverLimit: number;
  busy: boolean;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string, value: boolean) => void;
  onToggleAll: (value: boolean) => void;
  onApproveChosen: () => void;
}) {
  const chosen = items.filter((i) => checked[i.id]);
  const chosenSum = chosen.reduce((s, i) => s + i.amount, 0);
  const allChecked = items.length > 0 && items.every((i) => checked[i.id]);

  return (
    <section className="lg:col-span-3 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-xs">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th className="text-left p-3">อ้างอิง</th>
              <th className="text-left p-3">ช่าง</th>
              <th className="text-left p-3">รายการ</th>
              <th className="text-right p-3">ยอดอนุมัติ</th>
              <th className="text-left p-3">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr
                key={i.id}
                onClick={() => onSelect(i.id)}
                className={`border-b border-slate-100 cursor-pointer ${
                  selectedId === i.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={Boolean(checked[i.id])}
                    onChange={(e) => onToggleCheck(i.id, e.target.checked)}
                  />
                </td>
                <td className="p-3 font-mono-code text-xs text-blue-700 font-semibold">
                  {i.bookingRef}
                </td>
                <td className="p-3">{i.technicianName}</td>
                <td className="p-3 text-slate-700">{i.title}</td>
                <td className="p-3 text-right font-semibold tabular-nums">
                  {formatBaht(i.amount)}
                </td>
                <td className="p-3">
                  <StatusPill label="รออนุมัติ" tone="wait" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 p-3.5 flex flex-wrap justify-between items-center gap-3">
        <span className="text-sm">
          เลือกแล้ว <strong>{chosen.length}</strong> รายการ · รวม{' '}
          <strong>฿{formatBaht(chosenSum)}</strong>
          {chosenSum > approverLimit ? (
            <span className="ml-2 text-xs text-amber-800 font-semibold">
              (เกินวงเงิน Approver → ต้องใช้ Finance Manager)
            </span>
          ) : null}
        </span>
        <button
          type="button"
          disabled={chosen.length === 0 || busy}
          onClick={onApproveChosen}
          className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 cursor-pointer"
        >
          อนุมัติชุดที่เลือก & ส่ง Oracle ({chosen.length})
        </button>
      </div>
    </section>
  );
}
