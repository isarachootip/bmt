'use client';

import { useState } from 'react';

export function CloseJobSimulatorForm({
  onSubmitted,
}: {
  onSubmitted: (msg: string) => void;
}) {
  const [bookingNo, setBookingNo] = useState('BK-2611-00501');
  const [taskCode, setTaskCode] = useState('2.3');
  const [jobTitle, setJobTitle] = useState('ห้องครัว / 2.3 ระบบไฟ');
  const [jobType, setJobType] = useState<'Q' | 'R' | 'MA'>('R');
  const [technicianCode, setTechnicianCode] = useState('TC-0102');
  const [amount, setAmount] = useState('2000');
  const [qcStatus, setQcStatus] = useState('PASSED');
  const [confirmedBy, setConfirmedBy] = useState('นภา ใส่ใจ');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/webhooks/crm/close-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingNo,
        taskCode,
        jobTitle,
        jobType,
        technicianCode,
        amount: Number(amount),
        qcStatus,
        confirmedBy,
        closedAt: new Date().toISOString(),
      }),
    });
    const data = (await res.json()) as {
      outcome?: string;
      rejectReason?: string;
      message?: string;
    };
    setBusy(false);

    if (data.outcome === 'REJECTED') {
      onSubmitted(`ปฏิเสธ Close Job: ${data.rejectReason ?? ''}`);
      return;
    }
    if (!res.ok) {
      onSubmitted(`ผิดพลาด: ${data.message ?? 'ส่งไม่สำเร็จ'}`);
      return;
    }
    onSubmitted(
      data.outcome === 'DUPLICATE_UPDATED'
        ? `ส่งซ้ำ ${bookingNo} · ${taskCode} (Idempotent: ไม่สร้างรายการจ่ายซ้ำ)`
        : `สร้างรายการจ่ายจาก ${bookingNo} · ${taskCode} สำเร็จ → ไปที่คิวอนุมัติ`,
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="bg-white border border-blue-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end"
    >
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Booking No.
        <input
          value={bookingNo}
          onChange={(e) => setBookingNo(e.target.value)}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-sm font-mono-code"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Task Code / ประเภท
        <div className="flex gap-1">
          <input
            value={taskCode}
            onChange={(e) => setTaskCode(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm w-20 font-mono-code"
            required
          />
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value as 'Q' | 'R' | 'MA')}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1 bg-white"
          >
            <option value="Q">Q (30 วัน)</option>
            <option value="R">R (90 วัน)</option>
            <option value="MA">MA (90 วัน)</option>
          </select>
        </div>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        รหัสช่าง / ยอดเงิน (บาท)
        <div className="flex gap-1">
          <input
            value={technicianCode}
            onChange={(e) => setTechnicianCode(e.target.value.toUpperCase())}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24 font-mono-code"
            required
          />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1"
            required
          />
        </div>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        ผลตรวจ QC
        <select
          value={qcStatus}
          onChange={(e) => setQcStatus(e.target.value)}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="PASSED">PASSED (ผ่าน QC)</option>
          <option value="ESCALATED">ESCALATED (ไม่ผ่าน QC)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600 col-span-2">
        ชื่องาน
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-600">
        ผู้ยืนยัน Cust-Sat
        <input
          value={confirmedBy}
          onChange={(e) => setConfirmedBy(e.target.value)}
          className="border border-slate-300 rounded px-2.5 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="bg-blue-700 hover:bg-blue-800 text-white py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer"
      >
        ส่ง Webhook CRM → BMT
      </button>
    </form>
  );
}
