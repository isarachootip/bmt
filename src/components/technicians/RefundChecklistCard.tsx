'use client';

import { formatBaht } from '@/components/ui/StatusPill';

export function RefundChecklistCard({
  status,
  depositStatus,
  depositBalance,
  outstandingDebt,
  openClaimCount,
  activeWarrantyJobCount,
  onRequestRefund,
}: {
  status: string;
  depositStatus: string;
  depositBalance: number;
  outstandingDebt: number;
  openClaimCount: number;
  activeWarrantyJobCount: number;
  onRequestRefund: () => void;
}) {
  const canRefund =
    status === 'OFFBOARDING' &&
    depositStatus !== 'REFUND_PENDING' &&
    openClaimCount === 0 &&
    activeWarrantyJobCount === 0 &&
    depositBalance - outstandingDebt > 0;

  return (
    <aside className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3.5">
      <h2 className="text-lg font-bold text-slate-900">คืนเงินค้ำประกัน</h2>
      <ul className="text-sm flex flex-col gap-2">
        <li>
          {status === 'OFFBOARDING' ? '✓' : '!'}{' '}
          {status === 'OFFBOARDING' ? 'INT แจ้งพ้นสภาพแล้ว' : 'ช่างยังปฏิบัติงานอยู่'}
        </li>
        <li>
          {openClaimCount === 0 ? '✓' : '✕'}{' '}
          {openClaimCount === 0 ? 'ไม่มีเคลมค้าง' : `มีเคลมค้าง ${openClaimCount} งาน`}
        </li>
        <li>
          {activeWarrantyJobCount === 0 ? '✓' : '!'}{' '}
          {activeWarrantyJobCount === 0
            ? 'ไม่มีงานคงค้างในระยะประกัน'
            : `ยังมี ${activeWarrantyJobCount} งานในระยะประกัน`}
        </li>
      </ul>
      <div className="border border-slate-200 rounded-xl p-3 text-sm flex flex-col gap-1.5 bg-slate-50">
        <div className="flex justify-between">
          <span>เงินค้ำประกันคงเหลือ</span>
          <span>฿{formatBaht(depositBalance)}</span>
        </div>
        <div className="flex justify-between">
          <span>หักภาระหนี้คงค้าง</span>
          <span>฿{formatBaht(outstandingDebt)}</span>
        </div>
        <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5">
          <span>ยอดคืนสุทธิ</span>
          <span>฿{formatBaht(Math.max(0, depositBalance - outstandingDebt))}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={!canRefund}
        onClick={onRequestRefund}
        className="bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 cursor-pointer"
      >
        {depositStatus === 'REFUND_PENDING'
          ? 'ส่งคำขอคืนเงินเข้าคิวอนุมัติแล้ว'
          : 'สร้างรายการคืนเงินค้ำประกัน'}
      </button>
    </aside>
  );
}
