'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const QUICK_ACCOUNTS = [
  { email: 'wanna@company.co.th', label: 'วรรณา (Payment Officer)' },
  { email: 'somporn@company.co.th', label: 'สมพร (Approver ≤ 50,000)' },
  { email: 'teera@company.co.th', label: 'ธีระ (Finance Manager)' },
  { email: 'krit@company.co.th', label: 'กฤษณ์ (Admin)' },
  { email: 'auditor@company.co.th', label: 'ผู้บริหาร / Auditor' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('wanna@company.co.th');
  const [password, setPassword] = useState('demo-pass');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitLogin(targetEmail: string, quickSwitch: boolean) {
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        quickSwitch ? { email: targetEmail, quickSwitch: true } : { email: targetEmail, password },
      ),
    });
    const data = (await res.json()) as { message?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.message ?? 'เข้าสู่ระบบไม่สำเร็จ');
      return;
    }
    router.push('/technicians');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <section className="flex-1 bg-slate-900 text-white p-10 lg:p-16 flex flex-col justify-between gap-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-700 flex items-center justify-center font-bold">
            BMT
          </div>
          <span className="text-lg font-semibold">Builder Management</span>
        </div>

        <div className="max-w-lg flex flex-col gap-4">
          <h1 className="text-3xl lg:text-4xl font-bold leading-snug">
            ทำจ่ายช่างครบ ตรวจสอบได้ทุกบาท
          </h1>
          <p className="text-slate-300 leading-relaxed">
            เงินค้ำประกัน 10,000 บาท · จ่ายงวดแรก 90% เมื่อปิดงาน · ปล่อยเงิน Hold 10%
            เมื่อพ้นระยะรับประกัน — อนุมัติใน BMT แล้วส่งเข้า Oracle โดยตรงไม่ต้องออก IPO
          </p>
        </div>

        <span className="text-xs text-slate-400">
          ระบบภายในสำหรับ Payment Officer, Approver, Finance Manager, Auditor และ Admin
        </span>
      </section>

      <section className="flex-1 p-8 lg:p-16 flex items-center justify-center">
        <div className="w-full max-w-md flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">เข้าสู่ระบบพนักงาน</h2>
            <p className="text-sm text-slate-500 mt-1">
              รหัสผ่านเริ่มต้นสำหรับทุกบัญชีทดสอบคือ <code className="font-mono-code">demo-pass</code>
            </p>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitLogin(email, false);
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              อีเมลพนักงาน
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              รหัสผ่าน
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 cursor-pointer disabled:opacity-60"
            >
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              เข้าสู่ระบบด่วนด้วย Corporate SSO (เลือกตาม Role)
            </span>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => void submitLogin(acc.email, true)}
                  className="text-left px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm font-medium text-slate-800 flex justify-between items-center cursor-pointer"
                >
                  <span>{acc.label}</span>
                  <span className="text-xs text-blue-700 font-mono-code">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
