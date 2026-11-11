'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TechnicianInspector,
  type TechnicianRowDto,
} from '@/components/technicians/TechnicianInspector';
import {
  formatBaht,
  mapTechStatusBadge,
  StatusPill,
} from '@/components/ui/StatusPill';

const FILTERS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'ACTIVE', label: 'ACTIVE' },
  { key: 'PENDING_DEPOSIT', label: 'รอวาง/ยืนยันเงินค้ำ' },
  { key: 'SUSPENDED', label: 'SUSPENDED' },
  { key: 'OFFBOARDING', label: 'รอคืนเงิน' },
];

export default function TechniciansPage() {
  const [items, setItems] = useState<TechnicianRowDto[]>([]);
  const [requiredDeposit, setRequiredDeposit] = useState(10000);
  const [filter, setFilter] = useState('ALL');
  const [selectedCode, setSelectedCode] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [simOpen, setSimOpen] = useState(false);
  const [simCode, setSimCode] = useState('TC-0510');
  const [simName, setSimName] = useState('พงศ์พัฒน์ งานเนี๊ยบ');

  const loadData = useCallback(async () => {
    const res = await fetch('/api/technicians');
    if (!res.ok) return;
    const data = (await res.json()) as {
      requiredDeposit: number;
      items: TechnicianRowDto[];
    };
    setRequiredDeposit(data.requiredDeposit);
    setItems(data.items);
    setSelectedCode((prev) => prev || data.items[0]?.code || '');
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function simulateIntOnboarding(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/webhooks/int/technician-approved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        technicianCode: simCode,
        fullName: simName,
        bankName: 'กสิกรไทย',
        bankAccountNo: '088-2-99123-4',
        taxId: '1100700991234',
        approvedAt: new Date().toISOString(),
      }),
    });
    const body = (await res.json()) as { created?: boolean; message?: string };
    if (!res.ok) {
      setToastMsg(`ผิดพลาด: ${body.message ?? 'ส่ง Event ไม่สำเร็จ'}`);
      return;
    }
    setSimOpen(false);
    setSelectedCode(simCode);
    setToastMsg(
      body.created
        ? `รับช่างใหม่ ${simCode} จาก INT แล้ว (สถานะ PENDING_DEPOSIT)`
        : `ส่งซ้ำ ${simCode} (Idempotent: ไม่สร้างบัญชีซ้ำ)`,
    );
    await loadData();
  }

  const visible = items.filter((t) => filter === 'ALL' || t.status === filter);
  const selected =
    visible.find((t) => t.code === selectedCode) ?? visible[0] ?? items[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            บัญชีช่าง & เงินค้ำประกัน
          </h1>
          <p className="text-sm text-slate-600">
            ช่างที่ Approve ใน INT ต้องวางเงินค้ำประกันครบ ฿{formatBaht(requiredDeposit)}{' '}
            และ Finance ยืนยันก่อนรับงานได้
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSimOpen((v) => !v)}
          className="border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        >
          + จำลองรับช่างใหม่จาก INT Webhook
        </button>
      </div>

      {toastMsg ? (
        <div className="rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm flex justify-between items-center">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg('')}
            className="text-xs text-slate-300 underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      ) : null}

      {simOpen ? (
        <form
          onSubmit={(e) => void simulateIntOnboarding(e)}
          className="bg-white border border-blue-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Technician Code
            <input
              value={simCode}
              onChange={(e) => setSimCode(e.target.value.toUpperCase())}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono-code"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600 flex-1 min-w-48">
            ชื่อ-นามสกุลช่าง
            <input
              value={simName}
              onChange={(e) => setSimName(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              required
            />
          </label>
          <button
            type="submit"
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
          >
            ยิง Webhook INT → BMT
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === 'ALL'
              ? items.length
              : items.filter((t) => t.status === f.key).length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full text-sm border cursor-pointer ${
                filter === f.key
                  ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="text-left p-3">ช่าง</th>
                <th className="text-left p-3">รหัส</th>
                <th className="text-left p-3">สถานะ</th>
                <th className="text-right p-3">เงินค้ำประกัน</th>
                <th className="text-right p-3">เงิน Hold รอปล่อย</th>
                <th className="text-left p-3">Approve ใน INT</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const badge = mapTechStatusBadge(t.status, t.depositStatus);
                const isSel = selected?.code === t.code;
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedCode(t.code)}
                    className={`border-b border-slate-100 cursor-pointer ${
                      isSel ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-3 font-medium text-blue-700 underline">
                      {t.fullName}
                    </td>
                    <td className="p-3 font-mono-code text-xs">{t.code}</td>
                    <td className="p-3">
                      <StatusPill label={badge.label} tone={badge.tone} />
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatBaht(t.depositBalance)}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatBaht(t.heldRetentionTotal)}
                    </td>
                    <td className="p-3 text-slate-600">{t.intApprovedDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="lg:col-span-2">
          {selected ? (
            <TechnicianInspector
              key={`${selected.code}-${selected.status}-${selected.depositStatus}-${selected.depositBalance}`}
              tech={selected}
              requiredDeposit={requiredDeposit}
              onActionDone={(msg) => {
                setToastMsg(msg);
                void loadData();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
