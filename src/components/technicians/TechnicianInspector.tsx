'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  formatBaht,
  mapTechStatusBadge,
  StatusPill,
} from '@/components/ui/StatusPill';

export interface TechnicianRowDto {
  id: string;
  code: string;
  fullName: string;
  status: string;
  depositStatus: string;
  depositBalance: number;
  outstandingDebt: number;
  supplierCode: string | null;
  bankAccountMask: string;
  taxIdMask: string;
  intApprovedDate: string;
  heldRetentionTotal: number;
  statementToken: string;
}

export function TechnicianInspector({
  tech,
  requiredDeposit,
  onActionDone,
}: {
  tech: TechnicianRowDto;
  requiredDeposit: number;
  onActionDone: (msg: string) => void;
}) {
  const [evidenceRef, setEvidenceRef] = useState(`SLIP-${tech.code}`);
  const [amount, setAmount] = useState(String(Math.max(0, requiredDeposit - tech.depositBalance)));
  const [busy, setBusy] = useState(false);

  const badge = mapTechStatusBadge(tech.status, tech.depositStatus);
  const progressPct = Math.min(100, Math.round((tech.depositBalance / requiredDeposit) * 100));
  const canRecord =
    tech.depositStatus === 'AWAITING' || tech.depositStatus === 'PARTIAL_DEDUCTED';
  const canVerify =
    tech.depositStatus === 'RECEIVED' || tech.depositStatus === 'TOPUP_RECEIVED';

  async function handleDepositAction(action: 'record' | 'verify') {
    setBusy(true);
    const payload =
      action === 'record'
        ? {
            action: 'record',
            technicianCode: tech.code,
            amount: Number(amount),
            evidenceRef,
          }
        : { action: 'verify', technicianCode: tech.code };

    const res = await fetch('/api/technicians/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { message?: string };
    setBusy(false);

    if (!res.ok) {
      onActionDone(`ผิดพลาด: ${data.message ?? 'ไม่สามารถดำเนินการได้'}`);
      return;
    }
    onActionDone(
      action === 'verify'
        ? `ยืนยันเงินค้ำประกัน ${tech.fullName} เรียบร้อย · สถานะ ACTIVE และแจ้ง INT แล้ว`
        : `บันทึกรับหลักฐานเงินค้ำประกัน ${tech.fullName} เรียบร้อย`,
    );
  }

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{tech.fullName}</h2>
          <span className="text-xs text-slate-500">
            <span className="font-mono-code">{tech.code}</span> · Supplier{' '}
            {tech.supplierCode ?? 'รอสร้างเมื่อ ACTIVE'}
          </span>
        </div>
        <StatusPill label={badge.label} tone={badge.tone} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">เงินค้ำประกันที่ต้องวาง</span>
          <strong>฿{formatBaht(requiredDeposit)}</strong>
        </div>
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-blue-700" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs text-slate-500">
          ยืนยันแล้ว ฿{formatBaht(tech.depositBalance)} ({progressPct}%)
          {tech.outstandingDebt > 0
            ? ` · หนี้คงค้าง ฿${formatBaht(tech.outstandingDebt)}`
            : ''}
        </span>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm border-t border-b border-slate-100 py-3">
        <dt className="text-slate-500">บัญชีรับเงิน</dt>
        <dd className="text-slate-900 font-medium">{tech.bankAccountMask}</dd>
        <dt className="text-slate-500">เลขผู้เสียภาษี</dt>
        <dd className="text-slate-900 font-mono-code text-xs">{tech.taxIdMask}</dd>
        <dt className="text-slate-500">Approve ใน INT</dt>
        <dd className="text-slate-900">{tech.intApprovedDate}</dd>
        <dt className="text-slate-500">เงิน Hold รอปล่อย</dt>
        <dd className="text-slate-900">฿{formatBaht(tech.heldRetentionTotal)}</dd>
      </dl>

      {canRecord ? (
        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-xs font-semibold text-slate-700">
            บันทึกหลักฐานการโอนเงินค้ำประกัน / Top-up
          </span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white"
              placeholder="ยอดโอน (บาท)"
            />
            <input
              type="text"
              value={evidenceRef}
              onChange={(e) => setEvidenceRef(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white"
              placeholder="เลขสลิปอ้างอิง"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDepositAction('record')}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2 rounded-lg cursor-pointer"
          >
            บันทึกรับหลักฐานเงินโอน
          </button>
        </div>
      ) : null}

      {canVerify ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDepositAction('verify')}
            className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-lg cursor-pointer"
          >
            ยืนยันรับเงินครบ → เปลี่ยนเป็น ACTIVE & แจ้ง INT
          </button>
          <span className="text-xs text-slate-500">
            เฉพาะ Payment Officer / Finance Manager เท่านั้นที่ยืนยันได้
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={`/technicians/${tech.code}`}
          className="flex-1 text-center border border-slate-300 hover:bg-slate-50 rounded-lg py-2 px-3 text-sm font-semibold text-slate-800"
        >
          ดูประวัติ Ledger / คืนเงิน
        </Link>
        <Link
          href={`/statement/${tech.statementToken}`}
          target="_blank"
          className="flex-1 text-center border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg py-2 px-3 text-sm font-semibold text-blue-800"
        >
          Statement มือถือ ↗
        </Link>
      </div>
    </aside>
  );
}
