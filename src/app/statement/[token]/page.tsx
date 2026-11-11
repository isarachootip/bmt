'use client';

import { use, useEffect, useState } from 'react';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

interface StatementData {
  technician: {
    code: string;
    fullName: string;
    status: string;
    bankAccountMask: string;
    depositBalance: number;
    outstandingDebt: number;
    totalReceived: number;
    heldRetentionTotal: number;
  };
  jobs: Array<{
    id: string;
    bookingNo: string;
    taskCode: string;
    jobTitle: string;
    jobType: string;
    totalAmount: number;
    stage1Pct: number;
    stage2Pct: number;
    stage1Amount: number;
    stage2RemainingAmount: number;
    stage1Status: string;
    stage2Status: string;
    closedDate: string;
    warrantyEndDate: string;
    openClaimNo: string | null;
  }>;
}

export default function MobileStatementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<StatementData | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ALL' | 'PAID' | 'HELD'>('ALL');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/statement/${encodeURIComponent(token)}`);
      const body = (await res.json()) as StatementData & { message?: string };
      if (!res.ok) {
        setError(body.message ?? 'ลิงก์ไม่ถูกต้องหรือหมดอายุ');
        return;
      }
      setData(body);
    }
    void load();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
        <div className="bg-white border border-red-200 rounded-2xl p-6 max-w-sm text-center">
          <h1 className="text-lg font-bold text-red-800">ไม่สามารถเปิด Statement ได้</h1>
          <p className="text-sm text-slate-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        กำลังโหลด Statement ช่าง...
      </div>
    );
  }

  const { technician: me, jobs } = data;
  const shown = jobs.filter((j) =>
    tab === 'ALL'
      ? true
      : tab === 'PAID'
        ? j.stage1Status === 'PAID'
        : ['RETAINED', 'HOLD', 'DUE', 'WAIT_APPROVAL'].includes(j.stage2Status),
  );

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-3 flex justify-center">
      <div className="w-full max-w-md bg-slate-50 rounded-3xl shadow-xl overflow-hidden border-8 border-slate-900 flex flex-col">
        <header className="bg-slate-900 text-white p-5 flex flex-col gap-3.5">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-300">สวัสดี (Line OA Statement)</span>
              <h1 className="text-lg font-bold">{me.fullName}</h1>
              <span className="text-xs text-slate-400">{me.bankAccountMask}</span>
            </div>
            <StatusPill
              label={me.status}
              tone={me.status === 'ACTIVE' ? 'ok' : me.status === 'SUSPENDED' ? 'fail' : 'grey'}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-800 rounded-xl p-3">
              <span className="text-xs text-slate-300">ได้รับแล้ว</span>
              <div className="text-xl font-bold mt-0.5">฿{formatBaht(me.totalReceived)}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <span className="text-xs text-slate-300">เงิน Hold รอปล่อย</span>
              <div className="text-xl font-bold mt-0.5">
                ฿{formatBaht(me.heldRetentionTotal)}
              </div>
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-slate-800">
            <span>เงินค้ำประกัน ฿{formatBaht(me.depositBalance)}</span>
            <span>
              {me.outstandingDebt > 0
                ? `ภาระหักค้าง ฿${formatBaht(me.outstandingDebt)}`
                : 'ไม่มีหนี้คงค้าง ✓'}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-1 bg-slate-200 m-3 p-1 rounded-xl text-sm">
          {(
            [
              ['ALL', 'ทั้งหมด'],
              ['PAID', 'จ่ายแล้ว'],
              ['HELD', 'รอปล่อย Hold'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`py-2 rounded-lg cursor-pointer ${
                tab === k ? 'bg-white font-semibold shadow-xs text-slate-900' : 'text-slate-600'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        <ul className="flex-1 px-3 pb-5 flex flex-col gap-2.5">
          {shown.length === 0 ? (
            <li className="text-center text-sm text-slate-500 py-10">ยังไม่มีรายการงาน</li>
          ) : (
            shown.map((j) => (
              <li
                key={j.id}
                className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold text-sm text-slate-900">{j.jobTitle}</span>
                  <StatusPill
                    label={j.stage1Status === 'PAID' ? 'จ่ายงวดแรกแล้ว' : j.stage1Status}
                    tone={j.stage1Status === 'PAID' ? 'ok' : 'wait'}
                  />
                </div>
                <span className="font-mono-code text-xs text-slate-500">
                  {j.bookingNo} · Task {j.taskCode} · ปิดงาน {j.closedDate}
                </span>
                <div className="border-t border-dashed border-slate-200 pt-2 text-xs flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ค่างานรวม</span>
                    <span>฿{formatBaht(j.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">งวดแรก ({j.stage1Pct}%)</span>
                    <strong className="text-slate-900">฿{formatBaht(j.stage1Amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      เงิน Hold ({j.stage2Pct}%) ·{' '}
                      {j.stage2Status === 'PAID'
                        ? 'ปล่อยแล้ว'
                        : `พ้นประกัน ${j.warrantyEndDate}`}
                    </span>
                    <span>฿{formatBaht(j.stage2RemainingAmount)}</span>
                  </div>
                </div>
                {j.stage2Status === 'HOLD' ? (
                  <div className="bg-purple-50 text-purple-800 rounded-lg px-2.5 py-1.5 text-xs font-medium">
                    ระงับเงิน Hold ชั่วคราวจนกว่าเคลม {j.openClaimNo ?? 'ในประกัน'} จะปิด
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
