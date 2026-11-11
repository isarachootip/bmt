'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActorContext } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/close-jobs', label: 'รับ Close Job' },
  { href: '/approvals', label: 'คิวอนุมัติจ่าย' },
  { href: '/technicians', label: 'บัญชีช่าง & เงินค้ำประกัน' },
  { href: '/retention', label: 'เงิน Hold รอปล่อย' },
  { href: '/oracle', label: 'ส่ง Oracle' },
  { href: '/reports', label: 'รายงาน' },
  { href: '/audit', label: 'Audit Log' },
  { href: '/settings', label: 'ตั้งค่าระบบ' },
];

const DEMO_ROLES = [
  { email: 'wanna@company.co.th', label: 'วรรณา · Payment Officer' },
  { email: 'somporn@company.co.th', label: 'สมพร · Approver (≤50k)' },
  { email: 'teera@company.co.th', label: 'ธีระ · Finance Manager' },
  { email: 'krit@company.co.th', label: 'กฤษณ์ · Admin' },
  { email: 'auditor@company.co.th', label: 'ผู้บริหาร · Auditor' },
];

export function AppShell({
  actor,
  children,
}: {
  actor: ActorContext;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function handleSwitchRole(email: string) {
    setSwitching(true);
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, quickSwitch: true }),
    });
    setSwitching(false);
    router.refresh();
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-amber-100 text-amber-950 text-xs py-2 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200">
        <span>
          <strong>BMT – Technician Payment Service</strong> · ผู้ใช้งานปัจจุบัน:{' '}
          <strong>{actor.fullName}</strong> ({actor.role})
        </span>
        <label className="flex items-center gap-2">
          <span className="text-amber-900">สลับบทบาททดสอบ SoD:</span>
          <select
            disabled={switching}
            value={actor.email ?? ''}
            onChange={(e) => handleSwitchRole(e.target.value)}
            className="bg-white border border-amber-300 rounded px-2 py-0.5 text-xs font-medium text-slate-900"
          >
            {DEMO_ROLES.map((r) => (
              <option key={r.email} value={r.email}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="เมนูหลัก"
          className="w-full md:w-60 bg-slate-900 text-slate-300 p-4 flex md:flex-col gap-1 overflow-x-auto shrink-0"
        >
          <div className="hidden md:flex items-center gap-2.5 px-2 pb-4 mb-2 border-b border-slate-800 text-white">
            <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-sm">
              BMT
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-tight">Builder Mgmt</span>
              <span className="text-xs text-slate-400">Technician Payment</span>
            </div>
          </div>

          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition ${
                  active
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="md:mt-auto md:pt-4 md:border-t md:border-slate-800 flex flex-col gap-1">
            <a
              href="/api/openapi"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              OpenAPI 3.1 JSON ↗
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="text-left px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-slate-800 hover:text-rose-200 cursor-pointer"
            >
              ออกจากระบบ
            </button>
          </div>
        </nav>

        <main className="flex-1 min-w-0 p-5 md:p-8 flex flex-col gap-5">{children}</main>
      </div>
    </div>
  );
}
