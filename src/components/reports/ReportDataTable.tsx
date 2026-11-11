import type { ReportDataset, ReportTabKey } from './csv-export';
import { formatBaht, StatusPill } from '@/components/ui/StatusPill';

export function ReportDataTable({
  tab,
  data,
}: {
  tab: ReportTabKey;
  data: ReportDataset;
}) {
  if (tab === 'byTechnician') {
    return (
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            <th className="px-4 py-3">รหัสช่าง</th>
            <th className="px-4 py-3">ชื่อ-นามสกุล</th>
            <th className="px-4 py-3 text-right">จำนวนงาน</th>
            <th className="px-4 py-3 text-right">ยอดงานรวม</th>
            <th className="px-4 py-3 text-right">งวดแรก 90%</th>
            <th className="px-4 py-3 text-right">Hold คงค้าง</th>
            <th className="px-4 py-3 text-right">Hold จ่ายแล้ว</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.byTechnician.map((r) => (
            <tr key={r.code}>
              <td className="px-4 py-3 font-mono-code font-semibold">{r.code}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{r.fullName}</td>
              <td className="px-4 py-3 text-right">{r.jobCount}</td>
              <td className="px-4 py-3 text-right font-mono-code">{formatBaht(r.totalJobAmount)}</td>
              <td className="px-4 py-3 text-right font-mono-code">{formatBaht(r.stage1Total)}</td>
              <td className="px-4 py-3 text-right font-mono-code text-purple-700">
                {formatBaht(r.holdRemaining)}
              </td>
              <td className="px-4 py-3 text-right font-mono-code text-emerald-700">
                {formatBaht(r.holdReleased)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'aging') {
    return (
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            <th className="px-4 py-3">Booking / Task</th>
            <th className="px-4 py-3">ชื่อช่าง</th>
            <th className="px-4 py-3">วันครบกำหนดประกัน</th>
            <th className="px-4 py-3">สถานะงวด 2</th>
            <th className="px-4 py-3 text-right">เงิน Hold คงเหลือ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.aging.map((r) => (
            <tr key={r.bookingRef}>
              <td className="px-4 py-3 font-mono-code font-semibold">{r.bookingRef}</td>
              <td className="px-4 py-3">{r.technicianName}</td>
              <td className="px-4 py-3 font-mono-code">{r.warrantyEndDate}</td>
              <td className="px-4 py-3">
                <StatusPill label={r.stage2Status} tone={r.stage2Status === 'HOLD' ? 'fail' : 'hold'} />
              </td>
              <td className="px-4 py-3 text-right font-mono-code font-semibold">
                {formatBaht(r.holdAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tab === 'deposits') {
    return (
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
          <tr>
            <th className="px-4 py-3">รหัสช่าง</th>
            <th className="px-4 py-3">ชื่อ-นามสกุล</th>
            <th className="px-4 py-3">สถานะช่าง</th>
            <th className="px-4 py-3">สถานะเงินค้ำประกัน</th>
            <th className="px-4 py-3 text-right">ยอดค้ำประกันคงเหลือ</th>
            <th className="px-4 py-3 text-right">ยอดหนี้ค้างชำระ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.deposits.map((r) => (
            <tr key={r.code}>
              <td className="px-4 py-3 font-mono-code font-semibold">{r.code}</td>
              <td className="px-4 py-3">{r.fullName}</td>
              <td className="px-4 py-3">
                <StatusPill label={r.status} tone={r.status === 'ACTIVE' ? 'ok' : 'wait'} />
              </td>
              <td className="px-4 py-3 text-xs font-mono-code">{r.depositStatus}</td>
              <td className="px-4 py-3 text-right font-mono-code">{formatBaht(r.depositBalance)}</td>
              <td className="px-4 py-3 text-right font-mono-code text-rose-700">
                {formatBaht(r.outstandingDebt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
        <tr>
          <th className="px-4 py-3">Idempotency Key</th>
          <th className="px-4 py-3">อ้างอิง</th>
          <th className="px-4 py-3">ช่าง</th>
          <th className="px-4 py-3">ประเภท</th>
          <th className="px-4 py-3 text-right">จำนวนเงิน</th>
          <th className="px-4 py-3">สถานะ</th>
          <th className="px-4 py-3">เลขเอกสาร Oracle</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.oracleReconcile.map((r) => (
          <tr key={r.idempotencyKey}>
            <td className="px-4 py-3 font-mono-code text-xs">{r.idempotencyKey}</td>
            <td className="px-4 py-3 font-mono-code text-xs">{r.bookingRef}</td>
            <td className="px-4 py-3">{r.technicianName}</td>
            <td className="px-4 py-3 text-xs font-semibold">{r.kind}</td>
            <td className="px-4 py-3 text-right font-mono-code">{formatBaht(r.amount)}</td>
            <td className="px-4 py-3">
              <StatusPill
                label={r.status}
                tone={r.status === 'PAID' ? 'ok' : r.status === 'SYNC_FAILED' ? 'fail' : 'wait'}
              />
            </td>
            <td className="px-4 py-3 font-mono-code text-xs">{r.oracleDocNo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
