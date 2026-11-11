'use client';

import { useCallback, useEffect, useState } from 'react';
import { IntOnboardingSimulatorForm } from '@/components/technicians/IntOnboardingSimulatorForm';
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
        <IntOnboardingSimulatorForm
          onCreated={(code, msg) => {
            if (code) {
              setSimOpen(false);
              setSelectedCode(code);
            }
            setToastMsg(msg);
            void loadData();
          }}
        />
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
