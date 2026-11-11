'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  RetentionAgingChart,
  type AgingBucketDto,
  type DepositSummaryDto,
} from '@/components/dashboard/RetentionAgingChart';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

interface DashboardSummaryDto {
  oracleHealthy: boolean;
  kpis: {
    waitStage1Count: number;
    waitStage1Total: number;
    waitStage2Count: number;
    waitStage2Total: number;
    paidStage1Count: number;
    paidStage1Total: number;
    syncFailedCount: number;
    totalHeldRetention: number;
  };
  agingBuckets: AgingBucketDto[];
  depositSummary: DepositSummaryDto;
  recentJobs: Array<{
    bookingNo: string;
    taskCode: string;
    technicianName: string;
    jobTitle: string;
    totalAmount: number;
    stage1Amount: number;
    stage2RemainingAmount: number;
    stage1Status: string;
    stage2Status: string;
    closedDate: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummaryDto | null>(null);

  useEffect(() => {
    void fetch('/api/reports?mode=dashboard')
      .then((r) => (r.ok ? (r.json() as Promise<DashboardSummaryDto>) : null))
      .then((res) => setData(res));
  }, []);

  if (!data) {
    return <div className="text-sm text-slate-500 py-10">กำลังโหลดข้อมูลภาพรวมการเงิน...</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ภาพรวมการจ่ายเงินช่าง (Dashboard)</h1>
          <p className="text-sm text-slate-500">
            สถานะคิวอนุมัติจ่าย 90/10 เงินประกันผลงานคงค้าง และสุขภาพการเชื่อมต่อระบบภายนอก
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label="INT · ปกติ" tone="ok" />
          <StatusPill label="CRM · ปกติ" tone="ok" />
          <StatusPill
            label={data.oracleHealthy ? 'Oracle · ปกติ' : 'Oracle · มีรายการค้าง/503'}
            tone={data.oracleHealthy ? 'ok' : 'fail'}
          />
          <StatusPill label="LON (Line OA) · ปกติ" tone="ok" />
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link
          href="/approvals"
          className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 flex flex-col gap-1 transition"
        >
          <span className="text-xs font-semibold text-amber-700">รออนุมัติงวดแรก (90%)</span>
          <span className="text-2xl font-bold text-slate-900 font-mono-code">
            {formatBaht(data.kpis.waitStage1Total)} ฿
          </span>
          <span className="text-xs text-slate-500">{data.kpis.waitStage1Count} รายการในคิวอนุมัติ →</span>
        </Link>

        <Link
          href="/approvals"
          className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 flex flex-col gap-1 transition"
        >
          <span className="text-xs font-semibold text-purple-700">รออนุมัติปล่อยเงิน Hold (10%)</span>
          <span className="text-2xl font-bold text-slate-900 font-mono-code">
            {formatBaht(data.kpis.waitStage2Total)} ฿
          </span>
          <span className="text-xs text-slate-500">{data.kpis.waitStage2Count} รายการครบประกัน →</span>
        </Link>

        <Link
          href="/retention"
          className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 flex flex-col gap-1 transition"
        >
          <span className="text-xs font-semibold text-slate-600">เงิน Hold คงค้างรวมในระบบ</span>
          <span className="text-2xl font-bold text-slate-900 font-mono-code">
            {formatBaht(data.kpis.totalHeldRetention)} ฿
          </span>
          <span className="text-xs text-slate-500">ตรวจสอบระยะรับประกันและเคลม →</span>
        </Link>

        <Link
          href="/oracle"
          className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 flex flex-col gap-1 transition"
        >
          <span className="text-xs font-semibold text-emerald-700">จ่ายงวดแรกสำเร็จ / ค้างส่ง Oracle</span>
          <span className="text-2xl font-bold text-slate-900 font-mono-code">
            {formatBaht(data.kpis.paidStage1Total)} ฿
          </span>
          <span className="text-xs text-slate-500">
            จ่ายแล้ว {data.kpis.paidStage1Count} งาน · ส่งไม่สำเร็จ {data.kpis.syncFailedCount} รายการ →
          </span>
        </Link>
      </section>

      <RetentionAgingChart
        buckets={data.agingBuckets}
        depositSummary={data.depositSummary}
      />

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">รายการปิดงานล่าสุดจาก CRM</h2>
          <Link href="/close-jobs" className="text-xs font-semibold text-blue-700 hover:underline">
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Booking / Task</th>
                <th className="px-4 py-3">ช่างผู้รับงาน</th>
                <th className="px-4 py-3">ชื่องาน</th>
                <th className="px-4 py-3 text-right">งวดแรก 90%</th>
                <th className="px-4 py-3 text-right">Hold 10%</th>
                <th className="px-4 py-3">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentJobs.map((j) => (
                <tr key={`${j.bookingNo}-${j.taskCode}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono-code text-xs font-semibold text-slate-800">
                    {j.bookingNo} · {j.taskCode}
                    <div className="text-slate-400 font-normal">{j.closedDate}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{j.technicianName}</td>
                  <td className="px-4 py-3 text-slate-600">{j.jobTitle}</td>
                  <td className="px-4 py-3 text-right font-mono-code">{formatBaht(j.stage1Amount)}</td>
                  <td className="px-4 py-3 text-right font-mono-code">
                    {formatBaht(j.stage2RemainingAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusPill
                        label={`S1:${j.stage1Status}`}
                        tone={j.stage1Status === 'PAID' ? 'ok' : 'wait'}
                      />
                      <StatusPill
                        label={`S2:${j.stage2Status}`}
                        tone={j.stage2Status === 'HOLD' ? 'fail' : 'hold'}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
