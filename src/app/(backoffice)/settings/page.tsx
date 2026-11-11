'use client';

import { useEffect, useState } from 'react';
import {
  JobRuleCardList,
  type RuleDto,
} from '@/components/settings/JobRuleCardList';
import { StatusPill } from '@/components/ui/StatusPill';

interface SettingsPayload {
  currentRole: string;
  requiredDeposit: number;
  approverLimit: number;
  dispatchCadence: 'IMMEDIATE' | 'DAILY_1600' | 'WEEKLY';
  rules: RuleDto[];
  staff: Array<{ fullName: string; role: string; email: string | null }>;
}

export default function SettingsPage() {
  const [state, setState] = useState<SettingsPayload | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch('/api/settings')
      .then((r) => (r.ok ? (r.json() as Promise<SettingsPayload>) : null))
      .then((res) => setState(res));
  }, []);

  if (!state) {
    return <div className="text-sm text-slate-500 py-10">กำลังโหลดการตั้งค่าระบบ...</div>;
  }

  const isAdmin = state.currentRole === 'ADMIN';

  function updateRule(idx: number, patch: Partial<RuleDto>) {
    setState((prev) => {
      if (!prev) return prev;
      const nextRules = prev.rules.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, ...patch };
        updated.stage2Percent = Number((100 - updated.stage1Percent).toFixed(2));
        return updated;
      });
      return { ...prev, rules: nextRules };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return;
    setSaving(true);
    setToast('');
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requiredDeposit: state.requiredDeposit,
        approverLimit: state.approverLimit,
        dispatchCadence: state.dispatchCadence,
        rules: state.rules.map((r) => ({
          jobType: r.jobType,
          stage1Percent: r.stage1Percent,
          warrantyDays: r.warrantyDays,
        })),
      }),
    });
    const body = (await res.json()) as { message?: string };
    setSaving(false);
    setToast(
      res.ok
        ? 'บันทึกการตั้งค่าสำเร็จ (มีผลเฉพาะงานใหม่ที่ปิดหลังจากนี้ ไม่กระทบ Snapshot งานเดิม)'
        : (body.message ?? 'ไม่สามารถบันทึกได้'),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ตั้งค่าเงื่อนไขการเงินและสิทธิ์ระบบ</h1>
          <p className="text-sm text-slate-500">
            แก้ไขสัดส่วนแบ่งจ่าย ระยะเวลารับประกัน วงเงินอนุมัติ และรอบการส่งข้อมูลเข้า Oracle
          </p>
        </div>
        <StatusPill
          label={isAdmin ? 'สิทธิ์แก้ไข: ADMIN' : `โหมดอ่านอย่างเดียว (${state.currentRole})`}
          tone={isAdmin ? 'ok' : 'grey'}
        />
      </header>

      {toast ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
          {toast}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSave(e)} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <JobRuleCardList
          rules={state.rules}
          isAdmin={isAdmin}
          onUpdateRule={updateRule}
        />

        <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-base font-bold text-slate-900">
              เกณฑ์เงินค้ำประกัน วงเงินอนุมัติ และรอบส่ง Oracle
            </h2>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              เงินค้ำประกันแรกเข้าขั้นต่ำ (บาท)
              <input
                type="number"
                disabled={!isAdmin}
                value={state.requiredDeposit}
                onChange={(e) => setState({ ...state, requiredDeposit: Number(e.target.value) })}
                className="border border-slate-300 rounded-lg px-3 py-2 font-mono-code"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              เพดานวงเงินอนุมัติของ Approver (บาท · เกินนี้ต้องใช้ Finance Manager)
              <input
                type="number"
                disabled={!isAdmin}
                value={state.approverLimit}
                onChange={(e) => setState({ ...state, approverLimit: Number(e.target.value) })}
                className="border border-slate-300 rounded-lg px-3 py-2 font-mono-code"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              รอบการส่งคำสั่งจ่ายไป Oracle (Dispatch Cadence)
              <select
                disabled={!isAdmin}
                value={state.dispatchCadence}
                onChange={(e) =>
                  setState({
                    ...state,
                    dispatchCadence: e.target.value as SettingsPayload['dispatchCadence'],
                  })
                }
                className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="IMMEDIATE">IMMEDIATE · ส่งทันทีเมื่ออนุมัติ (ค่าเริ่มต้น)</option>
                <option value="DAILY_1600">DAILY_1600 · รอบรายวัน 16:00 น.</option>
                <option value="WEEKLY">WEEKLY · รอบรายสัปดาห์</option>
              </select>
            </label>
          </div>

          {isAdmin ? (
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าระบบ'}
            </button>
          ) : null}
        </section>
      </form>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-bold text-slate-900 mb-2">
          บัญชีผู้ใช้งานและกฎการแบ่งแยกหน้าที่ (Segregation of Duties)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {state.staff.map((u) => (
            <div key={u.email} className="rounded-lg border border-slate-200 p-3">
              <div className="font-bold text-slate-900">{u.fullName}</div>
              <div className="text-blue-700 font-mono-code mt-0.5">{u.role}</div>
              <div className="text-slate-400 font-mono-code truncate">{u.email}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
