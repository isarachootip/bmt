'use client';

import { useState } from 'react';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

export interface ApprovalItemDto {
  id: string;
  idempotencyKey: string;
  kind: 'STAGE1' | 'STAGE2' | 'DEPOSIT_REFUND' | 'ADJUSTMENT';
  bookingRef: string;
  title: string;
  amount: number;
  status: string;
  createdByUserId: string | null;
  technicianCode: string;
  technicianName: string;
  supplierCode: string;
  totalJobAmount: number;
  stage1Amount: number;
  stage2Amount: number;
  stage1Pct: number;
  stage2Pct: number;
  closedDate: string;
  warrantyEndDate: string;
  confirmedBy: string;
}

export function ApprovalDetailPane({
  item,
  busy,
  onDecideSingle,
}: {
  item: ApprovalItemDto;
  busy: boolean;
  onDecideSingle: (decision: 'APPROVE' | 'REJECT', note: string) => void;
}) {
  const [note, setNote] = useState('');

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex justify-between items-start gap-2">
        <div>
          <span className="font-mono-code text-xs text-slate-500">{item.bookingRef}</span>
          <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
          <span className="text-xs text-slate-500">
            ช่าง {item.technicianName} ({item.technicianCode}) · Supplier {item.supplierCode}
          </span>
        </div>
        <StatusPill label="รออนุมัติ" tone="wait" />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden text-sm">
        <div className="flex justify-between px-3.5 py-2.5 bg-slate-50 font-bold">
          <span>ค่างานอ้างอิง</span>
          <span>฿{formatBaht(item.totalJobAmount)}</span>
        </div>
        <div
          className={`flex justify-between px-3.5 py-2.5 border-t border-slate-200 ${
            item.kind === 'STAGE1' ? 'bg-blue-50/70' : ''
          }`}
        >
          <span>งวดแรก ({item.stage1Pct}%)</span>
          <strong>฿{formatBaht(item.stage1Amount)}</strong>
        </div>
        {item.stage2Pct > 0 ? (
          <div
            className={`flex justify-between px-3.5 py-2.5 border-t border-slate-200 ${
              item.kind === 'STAGE2' ? 'bg-blue-50/70' : ''
            }`}
          >
            <span>
              เงิน Hold ({item.stage2Pct}%) · พ้นประกัน {item.warrantyEndDate}
            </span>
            <strong>฿{formatBaht(item.stage2Amount)}</strong>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-800 text-sm">ที่มาของรายการ</span>
        <div>● ผ่าน QC ใน PMT · ปิดงาน {item.closedDate}</div>
        <div>● ยืนยันโดย {item.confirmedBy}</div>
        <div>
          ● Idempotency Key: <code className="font-mono-code">{item.idempotencyKey}</code>
        </div>
        <div>● อนุมัติใน BMT แล้วส่งเข้า Oracle ทันทีโดยไม่ผ่าน IPO</div>
      </div>

      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
        หมายเหตุผู้อนุมัติ (บังคับระบุเหตุผลเมื่อปฏิเสธ)
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ระบุเหตุผลหากปฏิเสธรายการนี้..."
          className="border border-slate-300 rounded-lg p-2.5 text-sm font-normal text-slate-900"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecideSingle('REJECT', note)}
          className="flex-1 border border-red-300 text-red-800 hover:bg-red-50 rounded-lg py-2.5 text-sm font-semibold cursor-pointer"
        >
          ปฏิเสธ
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecideSingle('APPROVE', note)}
          className="flex-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg py-2.5 px-4 text-sm font-semibold cursor-pointer"
        >
          อนุมัติ & ส่ง Oracle (฿{formatBaht(item.amount)})
        </button>
      </div>
    </aside>
  );
}
