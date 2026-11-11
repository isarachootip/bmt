'use client';

import { useEffect, useState } from 'react';
import {
  downloadReportCsv,
  type ReportDataset,
  type ReportTabKey,
} from '@/components/reports/csv-export';
import { ReportDataTable } from '@/components/reports/ReportDataTable';

const REPORT_TABS: Array<{ key: ReportTabKey; title: string; subtitle: string }> = [
  {
    key: 'byTechnician',
    title: 'สรุปการจ่ายรายช่าง',
    subtitle: 'ยอดงานรวม งวดแรก 90% และเงิน Hold คงค้าง/จ่ายแล้ว',
  },
  {
    key: 'aging',
    title: 'เงิน Hold คงค้าง (Aging)',
    subtitle: 'รายการเงินประกันผลงานที่ยังไม่ปล่อยตามวันครบกำหนด',
  },
  {
    key: 'deposits',
    title: 'เงินค้ำประกันช่าง',
    subtitle: 'ยอดเงินค้ำประกัน 10,000 บาท สถานะบัญชี และหนี้ค้างชำระ',
  },
  {
    key: 'oracleReconcile',
    title: 'กระทบยอดกับ Oracle',
    subtitle: 'เปรียบเทียบรายการเบิกจ่าย Idempotency Key และเลขที่เอกสาร Oracle',
  },
];

export default function ReportsPage() {
  const [data, setData] = useState<ReportDataset | null>(null);
  const [tab, setTab] = useState<ReportTabKey>('byTechnician');

  useEffect(() => {
    void fetch('/api/reports?mode=reports')
      .then((r) => (r.ok ? (r.json() as Promise<ReportDataset>) : null))
      .then((res) => setData(res));
  }, []);

  if (!data) {
    return <div className="text-sm text-slate-500 py-10">กำลังประมวลผลรายงานทางการเงิน...</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รายงานทางการเงินและกระทบยอด</h1>
          <p className="text-sm text-slate-500">
            ส่งออกข้อมูลเป็นไฟล์ CSV (รองรับภาษาไทย UTF-8 BOM สำหรับเปิดใน Excel)
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadReportCsv(tab, data)}
          className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
        >
          ดาวน์โหลด CSV รายงานนี้
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {REPORT_TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`text-left rounded-xl p-4 border transition cursor-pointer ${
                active
                  ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-sm font-bold text-slate-900">{item.title}</div>
              <div className="text-xs text-slate-500 mt-1">{item.subtitle}</div>
            </button>
          );
        })}
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <ReportDataTable tab={tab} data={data} />
      </section>
    </div>
  );
}
