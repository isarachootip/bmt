'use client';

import { useState } from 'react';

export function IntOnboardingSimulatorForm({
  onCreated,
}: {
  onCreated: (code: string, message: string) => void;
}) {
  const [simCode, setSimCode] = useState('TC-0510');
  const [simName, setSimName] = useState('พงศ์พัฒน์ งานเนี๊ยบ');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
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
    setSubmitting(false);

    if (!res.ok) {
      onCreated('', `ผิดพลาด: ${body.message ?? 'ส่ง Event ไม่สำเร็จ'}`);
      return;
    }
    onCreated(
      simCode,
      body.created
        ? `รับช่างใหม่ ${simCode} จาก INT แล้ว (สถานะ PENDING_DEPOSIT)`
        : `ส่งซ้ำ ${simCode} (Idempotent: ไม่สร้างบัญชีซ้ำ)`,
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
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
        disabled={submitting}
        className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
      >
        ยิง Webhook INT → BMT
      </button>
    </form>
  );
}
