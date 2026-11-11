'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ApprovalDetailPane,
  type ApprovalItemDto,
} from '@/components/approvals/ApprovalDetailPane';
import { ApprovalTable } from '@/components/approvals/ApprovalTable';
import { formatBaht } from '@/components/ui/StatusPill';

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItemDto[]>([]);
  const [approverLimit, setApproverLimit] = useState(50000);
  const [failedCount, setFailedCount] = useState(0);
  const [tab, setTab] = useState<'STAGE1' | 'STAGE2' | 'OTHER'>('STAGE1');
  const [selectedId, setSelectedId] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    const res = await fetch('/api/approvals');
    if (!res.ok) return;
    const data = (await res.json()) as {
      approverLimit: number;
      failedCount: number;
      items: ApprovalItemDto[];
    };
    setApproverLimit(data.approverLimit);
    setFailedCount(data.failedCount);
    setItems(data.items);
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const byTab = items.filter((i) =>
    tab === 'OTHER'
      ? i.kind === 'DEPOSIT_REFUND' || i.kind === 'ADJUSTMENT'
      : i.kind === tab,
  );
  const selected = byTab.find((i) => i.id === selectedId) ?? byTab[0];
  const chosenIds = byTab.filter((i) => checked[i.id]).map((i) => i.id);

  async function submitDecision(
    ids: string[],
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ) {
    setBusy(true);
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decide', payableIds: ids, decision, note }),
    });
    const body = (await res.json()) as { processedCount?: number; message?: string };
    setBusy(false);

    if (!res.ok) {
      setToast(`ไม่อนุญาต: ${body.message ?? 'ดำเนินการไม่สำเร็จ'}`);
      return;
    }
    setChecked({});
    setToast(
      decision === 'APPROVE'
        ? `อนุมัติ ${body.processedCount ?? ids.length} รายการ และส่งเข้า Oracle แล้ว`
        : `ปฏิเสธ ${body.processedCount ?? ids.length} รายการเรียบร้อย`,
    );
    await loadQueue();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">คิวอนุมัติจ่าย (BMT Approval)</h1>
        <p className="text-sm text-slate-600">
          อนุมัติใน BMT แล้วส่ง Oracle ทันทีโดยไม่ผ่าน IPO · วงเงิน Approver ≤ ฿
          {formatBaht(approverLimit)} (เกินวงเงินต้องใช้สิทธิ์ Finance Manager)
        </p>
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
            ['STAGE1', `งวดแรก 90% (${items.filter((i) => i.kind === 'STAGE1').length})`],
            ['STAGE2', `ปล่อยเงิน Hold 10% (${items.filter((i) => i.kind === 'STAGE2').length})`],
            [
              'OTHER',
              `คืนเงินค้ำ / ปรับปรุง (${items.filter((i) => i.kind === 'DEPOSIT_REFUND' || i.kind === 'ADJUSTMENT').length})`,
            ],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm border cursor-pointer ${
              tab === k ? 'bg-slate-900 text-white border-slate-900 font-semibold' : 'bg-white border-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
        <Link
          href="/oracle"
          className="px-4 py-2 rounded-full text-sm border border-red-200 bg-red-50 text-red-800 font-semibold"
        >
          SYNC_FAILED ({failedCount})
        </Link>
      </div>

      {byTab.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-800">ไม่มีรายการรออนุมัติในแท็บนี้</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          <ApprovalTable
            items={byTab}
            selectedId={selected?.id}
            checked={checked}
            approverLimit={approverLimit}
            busy={busy}
            onSelect={setSelectedId}
            onToggleCheck={(id, v) => setChecked((prev) => ({ ...prev, [id]: v }))}
            onToggleAll={(v) => {
              const next = { ...checked };
              byTab.forEach((i) => {
                next[i.id] = v;
              });
              setChecked(next);
            }}
            onApproveChosen={() => void submitDecision(chosenIds, 'APPROVE')}
          />
          <div className="lg:col-span-2">
            {selected ? (
              <ApprovalDetailPane
                key={selected.id}
                item={selected}
                busy={busy}
                onDecideSingle={(d, n) => void submitDecision([selected.id], d, n)}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
