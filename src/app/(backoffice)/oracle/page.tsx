'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  OracleAttemptLog,
  type OracleAttemptDto,
} from '@/components/oracle/OracleAttemptLog';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

interface OracleItemDto {
  id: string;
  idempotencyKey: string;
  bookingRef: string;
  kind: string;
  title: string;
  supplierCode: string;
  technicianName: string;
  amount: number;
  status: string;
  oracleAttempts: number;
  oracleDocNo: string | null;
  paidAt: string | null;
}

export default function OracleSyncPage() {
  const [simMode, setSimMode] = useState('NORMAL');
  const [items, setItems] = useState<OracleItemDto[]>([]);
  const [attempts, setAttempts] = useState<OracleAttemptDto[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SYNC_FAILED' | 'PAID'>('ALL');
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    const res = await fetch('/api/oracle');
    if (!res.ok) return;
    const data = (await res.json()) as {
      oracleSimMode: string;
      items: OracleItemDto[];
      attempts: OracleAttemptDto[];
    };
    setSimMode(data.oracleSimMode);
    setItems(data.items);
    setAttempts(data.attempts);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function postAction(payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch('/api/oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      message?: string;
      checked?: number;
      failedPending?: number;
      status?: string;
    };
    if (!res.ok) {
      setToast(`ผิดพลาด: ${data.message ?? 'ดำเนินการไม่สำเร็จ'}`);
      return;
    }
    if (payload.action === 'reconcile') {
      setToast(
        `กระทบยอดเสร็จสิ้น: ตรวจแล้ว ${data.checked} รายการ · ค้าง SYNC_FAILED ${data.failedPending} รายการ`,
      );
    } else if (payload.action === 'resend') {
      setToast(`ผลส่งซ้ำ: สถานะปัจจุบันคือ ${data.status}`);
    } else {
      setToast(successMsg);
    }
    await loadData();
  }

  const shown = items.filter((i) => filter === 'ALL' || i.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ส่ง Oracle (AP Payment Request)</h1>
          <p className="text-sm text-slate-600">
            ส่งตรงเข้า Oracle ไม่ผ่าน IPO · Retry อัตโนมัติ 3 ครั้งพร้อม Idempotency Key
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void postAction(
                { action: 'sim', mode: simMode === 'NORMAL' ? 'FAIL_503' : 'NORMAL' },
                'สลับโหมด Oracle Simulator เรียบร้อย',
              )
            }
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
              simMode === 'FAIL_503'
                ? 'bg-red-100 border-red-300 text-red-900'
                : 'bg-green-50 border-green-300 text-green-900'
            }`}
          >
            โหมดจำลอง Oracle: {simMode === 'FAIL_503' ? 'ล่ม (HTTP 503)' : 'ปกติ (HTTP 201)'}
          </button>
          <button
            type="button"
            onClick={() => void postAction({ action: 'reconcile' }, '')}
            className="border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          >
            กระทบยอด (Reconcile) วันนี้
          </button>
        </div>
      </div>

      {toast ? (
        <div className="rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm flex justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="text-xs underline">
            ปิด
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['ALL', `ทั้งหมด (${items.length})`],
            ['SYNC_FAILED', `SYNC_FAILED (${items.filter((i) => i.status === 'SYNC_FAILED').length})`],
            ['PAID', `จ่ายแล้ว (${items.filter((i) => i.status === 'PAID').length})`],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-3.5 py-1.5 rounded-full text-sm border cursor-pointer ${
              filter === k ? 'bg-slate-900 text-white border-slate-900 font-semibold' : 'bg-white border-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-xs">
              <th className="text-left p-3">อ้างอิง</th>
              <th className="text-left p-3">รายการ</th>
              <th className="text-left p-3">Supplier</th>
              <th className="text-right p-3">ยอดเงิน</th>
              <th className="text-left p-3">ครั้ง</th>
              <th className="text-left p-3">เลขเอกสาร Oracle</th>
              <th className="text-left p-3">สถานะ</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-slate-100 ${r.status === 'SYNC_FAILED' ? 'bg-red-50/60' : ''}`}
              >
                <td className="p-3 font-mono-code text-xs">{r.bookingRef}</td>
                <td className="p-3">{r.title}</td>
                <td className="p-3 font-mono-code text-xs">{r.supplierCode}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{formatBaht(r.amount)}</td>
                <td className="p-3 text-xs">{r.oracleAttempts}/3</td>
                <td className="p-3 font-mono-code text-xs">{r.oracleDocNo ?? '-'}</td>
                <td className="p-3">
                  <StatusPill
                    label={r.status}
                    tone={r.status === 'PAID' ? 'ok' : r.status === 'SYNC_FAILED' ? 'fail' : 'sent'}
                  />
                </td>
                <td className="p-3 text-right">
                  {r.status === 'SYNC_FAILED' ? (
                    <button
                      type="button"
                      onClick={() => void postAction({ action: 'resend', payableId: r.id }, '')}
                      className="border border-red-300 bg-white text-red-800 hover:bg-red-50 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      ส่งซ้ำ
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <OracleAttemptLog attempts={attempts} />
    </div>
  );
}
