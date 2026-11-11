'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusPill } from '@/components/ui/StatusPill';

interface AuditRowDto {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityRef: string;
  oldValue: string | null;
  newValue: string;
}

export default function AuditLogPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AuditRowDto[]>([]);

  const loadLogs = useCallback(async (q: string) => {
    const url = q.trim()
      ? `/api/audit?q=${encodeURIComponent(q.trim())}`
      : '/api/audit';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = (await res.json()) as { items: AuditRowDto[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, loadLogs]);

  function exportCsv() {
    const header = ['เวลา', 'ผู้ทำรายการ', 'บทบาท', 'Action', 'อ้างอิง', 'ค่าเดิม', 'ค่าใหม่'];
    const rows = items.map((r) => [
      r.timestamp,
      r.actorName,
      r.actorRole,
      r.action,
      r.entityRef,
      r.oldValue ?? '-',
      r.newValue,
    ]);
    const csv =
      '\uFEFF' +
      [header, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bmt-audit-log.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-600">
            บันทึกทุกการเปลี่ยนสถานะ แก้ไขตั้งค่า และเรียก API · เวลา Asia/Bangkok ·
            ป้องกันการแก้ไขหรือลบในระดับ PostgreSQL Trigger
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        >
          ส่งออก CSV (Excel)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-600 flex-1 min-w-64">
          ค้นหา (Booking No., รหัสช่าง, ผู้ทำรายการ หรือ Action)
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="เช่น TC-0457 หรือ BK-2611-00418"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <span className="text-xs text-slate-500">แสดง {items.length} รายการล่าสุด</span>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-xs">
              <th className="text-left p-3">เวลา</th>
              <th className="text-left p-3">ผู้ทำรายการ</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">อ้างอิง</th>
              <th className="text-left p-3">ค่าเดิม → ค่าใหม่</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="p-3 whitespace-nowrap text-slate-600">{a.timestamp}</td>
                <td className="p-3 whitespace-nowrap">
                  <StatusPill
                    label={a.actorName}
                    tone={a.actorRole === 'SYSTEM' ? 'grey' : 'sent'}
                  />
                </td>
                <td className="p-3 font-medium text-slate-900">{a.action}</td>
                <td className="p-3 font-mono-code text-xs">{a.entityRef}</td>
                <td className="p-3 text-slate-700">
                  {a.oldValue ? `${a.oldValue} → ` : ''}
                  {a.newValue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
