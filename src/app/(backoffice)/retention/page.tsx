'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  RetentionTable,
  type RetentionItemDto,
} from '@/components/retention/RetentionTable';
import { formatBaht } from '@/components/ui/StatusPill';

export default function RetentionPage() {
  const [items, setItems] = useState<RetentionItemDto[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'RETAINED' | 'HOLD' | 'WAIT_APPROVAL' | 'PAID'>('ALL');
  const [resolvingClaim, setResolvingClaim] = useState<string | null>(null);
  const [damageAmt, setDamageAmt] = useState('0');
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    const res = await fetch('/api/retention');
    if (!res.ok) return;
    const data = (await res.json()) as { items: RetentionItemDto[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function runScheduler() {
    const res = await fetch('/api/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scheduler' }),
    });
    const body = (await res.json()) as { releasedCount?: number; message?: string };
    setToast(
      res.ok
        ? `รัน Scheduler เสร็จสิ้น: ส่งเข้าคิวอนุมัติปล่อย Hold ${body.releasedCount ?? 0} งาน`
        : `ผิดพลาด: ${body.message ?? ''}`,
    );
    await loadData();
  }

  async function openQuickClaim(j: RetentionItemDto) {
    const claimNo = `CL-${Date.now().toString().slice(-4)}`;
    const res = await fetch('/api/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'openClaim',
        claimNo,
        bookingNo: j.bookingNo,
        taskCode: j.taskCode,
        reason: 'ลูกค้าแจ้งซ่อมงานในระยะประกัน',
      }),
    });
    const body = (await res.json()) as { message?: string };
    setToast(res.ok ? `เปิดเคลม ${claimNo} · ระงับเงิน Hold แล้ว` : `ผิดพลาด: ${body.message}`);
    await loadData();
  }

  async function submitResolveClaim(claimNo: string) {
    const res = await fetch('/api/retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resolveClaim',
        claimNo,
        damageAmount: Number(damageAmt) || 0,
      }),
    });
    const body = (await res.json()) as {
      deductedFromHold?: number;
      deductedFromDeposit?: number;
      message?: string;
    };
    if (!res.ok) {
      setToast(`ผิดพลาด: ${body.message}`);
      return;
    }
    setResolvingClaim(null);
    setDamageAmt('0');
    setToast(
      `ปิดเคลม ${claimNo} · หัก Hold ฿${formatBaht(body.deductedFromHold ?? 0)} · หักค้ำประกัน ฿${formatBaht(body.deductedFromDeposit ?? 0)}`,
    );
    await loadData();
  }

  const shown = items.filter((i) => filter === 'ALL' || i.stage2Status === filter);
  const sumBy = (st: string) =>
    items.filter((i) => i.stage2Status === st).reduce((s, i) => s + i.stage2RemainingAmount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">เงิน Hold 10% รอปล่อย (Retention)</h1>
          <p className="text-sm text-slate-600">
            Scheduler ตรวจงานพ้นประกันรายวัน · ข้ามงานที่ติดเคลม (HOLD) · รองรับหักเคลมแบบ Cascade
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runScheduler()}
            className="border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          >
            รัน Scheduler ตรวจวันพ้นประกันทันที
          </button>
          <Link
            href="/approvals"
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            ไปคิวอนุมัติปล่อย Hold →
          </Link>
        </div>
      </div>

      {toast ? (
        <div className="rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm">{toast}</div>
      ) : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">อยู่ในประกัน (RETAINED)</span>
          <div className="text-2xl font-bold">฿{formatBaht(sumBy('RETAINED'))}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-blue-700">รออนุมัติปล่อย (DUE/WAIT)</span>
          <div className="text-2xl font-bold text-blue-700">
            ฿{formatBaht(sumBy('WAIT_APPROVAL') + sumBy('DUE'))}
          </div>
        </div>
        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4">
          <span className="text-xs text-purple-800">ระงับมีเคลม (HOLD)</span>
          <div className="text-2xl font-bold text-purple-900">฿{formatBaht(sumBy('HOLD'))}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-green-700">ปล่อยจ่ายแล้ว (PAID)</span>
          <div className="text-2xl font-bold text-green-700">฿{formatBaht(sumBy('PAID'))}</div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['ALL', 'ทั้งหมด'],
            ['RETAINED', 'อยู่ในประกัน'],
            ['HOLD', 'มีเคลม (HOLD)'],
            ['WAIT_APPROVAL', 'รออนุมัติปล่อย'],
            ['PAID', 'ปล่อยแล้ว'],
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

      {resolvingClaim ? (
        <div className="bg-purple-50 border border-purple-300 rounded-xl p-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-purple-950">
            ปิดเคลม {resolvingClaim} · ค่าเสียหายที่ต้องหักช่าง (บาท) — 0 = ไม่มีค่าเสียหาย
            <input
              type="number"
              min="0"
              value={damageAmt}
              onChange={(e) => setDamageAmt(e.target.value)}
              className="border border-purple-300 bg-white rounded-lg px-3 py-1.5 text-sm w-64"
            />
          </label>
          <button
            type="button"
            onClick={() => void submitResolveClaim(resolvingClaim)}
            className="bg-purple-800 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          >
            ยืนยันปิดเคลม & หัก Cascade
          </button>
        </div>
      ) : null}

      <RetentionTable
        items={shown}
        onOpenClaim={(j) => void openQuickClaim(j)}
        onSelectResolveClaim={setResolvingClaim}
      />
    </div>
  );
}
