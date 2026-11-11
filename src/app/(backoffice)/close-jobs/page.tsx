'use client';

import { useCallback, useEffect, useState } from 'react';
import { CloseJobSimulatorForm } from '@/components/close-jobs/CloseJobSimulatorForm';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

interface CloseJobEventDto {
  id: string;
  receivedAt: string;
  bookingNo: string;
  taskCode: string;
  jobTitle: string;
  jobType: string;
  technicianCode: string;
  technicianName: string;
  technicianStatus: string;
  amount: number;
  qcStatus: string;
  confirmedBy: string;
  result: 'ACCEPTED' | 'DUPLICATE_UPDATED' | 'REJECTED';
  rejectReason: string | null;
  rawPayload: string;
}

export default function CloseJobsPage() {
  const [events, setEvents] = useState<CloseJobEventDto[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [simOpen, setSimOpen] = useState(false);
  const [toast, setToast] = useState('');

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/close-jobs');
    if (!res.ok) return;
    const data = (await res.json()) as { items: CloseJobEventDto[] };
    setEvents(data.items);
    setSelectedId((prev) => prev || data.items[0]?.id || '');
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const sel = events.find((e) => e.id === selectedId) ?? events[0];
  const accepted = events.filter((e) => e.result === 'ACCEPTED').length;
  const dup = events.filter((e) => e.result === 'DUPLICATE_UPDATED').length;
  const rej = events.filter((e) => e.result === 'REJECTED').length;

  function renderResultBadge(res: CloseJobEventDto['result']) {
    if (res === 'ACCEPTED') return <StatusPill label="สร้างรายการจ่ายแล้ว" tone="ok" />;
    if (res === 'DUPLICATE_UPDATED') return <StatusPill label="ส่งซ้ำ · ไม่สร้างใหม่" tone="grey" />;
    return <StatusPill label="ปฏิเสธ · ต้องตรวจสอบ" tone="fail" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รับ Close Job จาก CRM</h1>
          <p className="text-sm text-slate-600">
            Event ที่ทีม Cust-Sat ยืนยันหลังผ่าน QC · ระบบตรวจเงื่อนไขและสร้างรายการจ่ายอัตโนมัติ
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSimOpen((v) => !v)}
          className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        >
          + จำลองส่ง Close Job จาก CRM
        </button>
      </div>

      {toast ? (
        <div className="rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm flex justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="text-xs underline">
            ปิด
          </button>
        </div>
      ) : null}

      {simOpen ? (
        <CloseJobSimulatorForm
          onSubmitted={(msg) => {
            setToast(msg);
            void loadEvents();
          }}
        />
      ) : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Event ทั้งหมด</span>
          <div className="text-2xl font-bold">{events.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">สร้างรายการจ่ายแล้ว</span>
          <div className="text-2xl font-bold text-green-700">{accepted}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">ส่งซ้ำ (Idempotent)</span>
          <div className="text-2xl font-bold text-slate-700">{dup}</div>
        </div>
        <div className="bg-red-50/70 border border-red-200 rounded-xl p-4">
          <span className="text-xs text-red-800">ปฏิเสธ · ต้องตรวจสอบ</span>
          <div className="text-2xl font-bold text-red-800">{rej}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="text-left p-3">รับเมื่อ</th>
                <th className="text-left p-3">Booking / Task</th>
                <th className="text-left p-3">ช่าง</th>
                <th className="text-right p-3">ค่างาน</th>
                <th className="text-left p-3">QC</th>
                <th className="text-left p-3">ผลตรวจ</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`border-b border-slate-100 cursor-pointer ${
                    sel?.id === e.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="p-3 text-xs text-slate-600">{e.receivedAt}</td>
                  <td className="p-3">
                    <div className="font-mono-code text-xs text-blue-700 font-semibold">
                      {e.bookingNo} · {e.taskCode}
                    </div>
                    <div className="text-xs text-slate-500">{e.jobTitle}</div>
                  </td>
                  <td className="p-3">{e.technicianName}</td>
                  <td className="p-3 text-right tabular-nums">{formatBaht(e.amount)}</td>
                  <td className="p-3">
                    <StatusPill
                      label={e.qcStatus}
                      tone={e.qcStatus === 'PASSED' ? 'ok' : 'wait'}
                    />
                  </td>
                  <td className="p-3">{renderResultBadge(e.result)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {sel ? (
          <aside className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3">
            <div>
              <span className="font-mono-code text-xs text-slate-500">
                {sel.bookingNo} · Task {sel.taskCode} ({sel.jobType})
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{sel.jobTitle}</h2>
            </div>
            <ul className="text-sm flex flex-col gap-1.5 border-t border-b border-slate-100 py-3">
              <li>
                {sel.qcStatus === 'PASSED' ? '✓' : '✕'} สถานะ QC: <strong>{sel.qcStatus}</strong>
              </li>
              <li>
                {sel.confirmedBy ? '✓' : '✕'} Cust-Sat ยืนยันโดย:{' '}
                <strong>{sel.confirmedBy || '-'}</strong>
              </li>
              <li>
                {sel.technicianStatus === 'ACTIVE' ? '✓' : '✕'} ช่าง {sel.technicianCode}:{' '}
                <strong>{sel.technicianStatus}</strong>
              </li>
            </ul>
            {sel.rejectReason ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                สาเหตุที่ปฏิเสธ: {sel.rejectReason}
              </div>
            ) : null}
            <div>
              <span className="text-xs font-semibold text-slate-500">Raw Payload จาก CRM</span>
              <pre className="mt-1 bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto font-mono-code">
                {sel.rawPayload}
              </pre>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
