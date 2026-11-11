'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { RefundChecklistCard } from '@/components/technicians/RefundChecklistCard';
import {
  formatBaht,
  mapTechStatusBadge,
  StatusPill,
} from '@/components/ui/StatusPill';

interface TechDetailPayload {
  technician: {
    code: string;
    fullName: string;
    status: string;
    depositStatus: string;
    supplierCode: string | null;
    bankAccountMask: string;
    taxIdMask: string;
    depositBalance: number;
    outstandingDebt: number;
    totalPaid: number;
    heldRetentionTotal: number;
    activeWarrantyJobCount: number;
    openClaimCount: number;
  };
  ledger: Array<{
    id: string;
    timestamp: string;
    entryType: string;
    referenceCode: string;
    description: string;
    amount: number;
    balanceAfter: number;
  }>;
}

export default function TechnicianLedgerDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [data, setData] = useState<TechDetailPayload | null>(null);
  const [toast, setToast] = useState('');

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/technicians/${encodeURIComponent(code)}`);
    if (!res.ok) return;
    setData((await res.json()) as TechDetailPayload);
  }, [code]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function triggerAction(action: 'offboard' | 'refund') {
    const res = await fetch(`/api/technicians/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const body = (await res.json()) as { refundAmount?: number; message?: string };
    if (!res.ok) {
      setToast(`ผิดพลาด: ${body.message ?? ''}`);
      return;
    }
    setToast(
      action === 'offboard'
        ? `เปลี่ยนสถานะ ${code} เป็น OFFBOARDING เรียบร้อย`
        : `สร้างรายการคืนเงินค้ำประกัน ฿${formatBaht(body.refundAmount ?? 0)} ส่งเข้าคิวอนุมัติแล้ว`,
    );
    await loadDetail();
  }

  if (!data) {
    return <div className="text-sm text-slate-500">กำลังโหลดข้อมูลบัญชีช่าง...</div>;
  }

  const t = data.technician;
  const badge = mapTechStatusBadge(t.status, t.depositStatus);

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-xs text-slate-500">
        <Link href="/technicians" className="text-blue-700 underline">
          บัญชีช่าง
        </Link>{' '}
        / {t.fullName} ({t.code})
      </nav>

      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.fullName}</h1>
          <span className="text-xs text-slate-500">
            <code className="font-mono-code">{t.code}</code> · Supplier {t.supplierCode ?? '-'} ·{' '}
            {t.bankAccountMask} · Tax {t.taxIdMask}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill label={badge.label} tone={badge.tone} />
          {t.status === 'ACTIVE' || t.status === 'SUSPENDED' ? (
            <button
              type="button"
              onClick={() => void triggerAction('offboard')}
              className="border border-slate-300 bg-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              จำลองแจ้งพ้นสภาพจาก INT (OFFBOARDING)
            </button>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div className="rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm">{toast}</div>
      ) : null}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">เงินค้ำประกันคงเหลือ</span>
          <div className="text-2xl font-bold">฿{formatBaht(t.depositBalance)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">เงิน Hold รอปล่อย</span>
          <div className="text-2xl font-bold">฿{formatBaht(t.heldRetentionTotal)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">จ่ายค่างานแล้วรวม</span>
          <div className="text-2xl font-bold text-green-700">฿{formatBaht(t.totalPaid)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">ภาระหนี้หักคงค้าง</span>
          <div className="text-2xl font-bold text-red-700">฿{formatBaht(t.outstandingDebt)}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="text-left p-3">เวลา</th>
                <th className="text-left p-3">รายการเคลื่อนไหว</th>
                <th className="text-left p-3">อ้างอิง</th>
                <th className="text-right p-3">ยอดเงิน</th>
                <th className="text-right p-3">ค้ำประกันหลังรายการ</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{e.timestamp}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3 font-mono-code text-xs">{e.referenceCode}</td>
                  <td
                    className={`p-3 text-right font-semibold tabular-nums ${
                      e.amount < 0 ? 'text-red-700' : 'text-slate-900'
                    }`}
                  >
                    {formatBaht(e.amount)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-600">
                    {formatBaht(e.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <RefundChecklistCard
          status={t.status}
          depositStatus={t.depositStatus}
          depositBalance={t.depositBalance}
          outstandingDebt={t.outstandingDebt}
          openClaimCount={t.openClaimCount}
          activeWarrantyJobCount={t.activeWarrantyJobCount}
          onRequestRefund={() => void triggerAction('refund')}
        />
      </div>
    </div>
  );
}
