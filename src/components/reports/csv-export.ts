export interface ReportDataset {
  byTechnician: Array<{
    code: string;
    fullName: string;
    jobCount: number;
    totalJobAmount: number;
    stage1Total: number;
    holdRemaining: number;
    holdReleased: number;
  }>;
  aging: Array<{
    bookingRef: string;
    technicianName: string;
    warrantyEndDate: string;
    stage2Status: string;
    holdAmount: number;
  }>;
  deposits: Array<{
    code: string;
    fullName: string;
    status: string;
    depositStatus: string;
    depositBalance: number;
    outstandingDebt: number;
  }>;
  oracleReconcile: Array<{
    idempotencyKey: string;
    bookingRef: string;
    technicianName: string;
    kind: string;
    amount: number;
    status: string;
    oracleDocNo: string;
  }>;
}

export type ReportTabKey = 'byTechnician' | 'aging' | 'deposits' | 'oracleReconcile';

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadReportCsv(tab: ReportTabKey, data: ReportDataset): void {
  let headers: string[] = [];
  let rows: Array<Array<string | number>> = [];

  if (tab === 'byTechnician') {
    headers = [
      'รหัสช่าง',
      'ชื่อ-นามสกุล',
      'จำนวนงาน',
      'ยอดงานรวม (บาท)',
      'งวดแรก 90% (บาท)',
      'Hold คงค้าง (บาท)',
      'Hold จ่ายแล้ว (บาท)',
    ];
    rows = data.byTechnician.map((r) => [
      r.code,
      r.fullName,
      r.jobCount,
      r.totalJobAmount.toFixed(2),
      r.stage1Total.toFixed(2),
      r.holdRemaining.toFixed(2),
      r.holdReleased.toFixed(2),
    ]);
  } else if (tab === 'aging') {
    headers = ['Booking / Task', 'ชื่อช่าง', 'วันครบกำหนดรับประกัน', 'สถานะงวด 2', 'เงิน Hold คงเหลือ (บาท)'];
    rows = data.aging.map((r) => [
      r.bookingRef,
      r.technicianName,
      r.warrantyEndDate,
      r.stage2Status,
      r.holdAmount.toFixed(2),
    ]);
  } else if (tab === 'deposits') {
    headers = ['รหัสช่าง', 'ชื่อ-นามสกุล', 'สถานะช่าง', 'สถานะเงินค้ำประกัน', 'ยอดค้ำประกันคงเหลือ', 'ยอดหนี้ค้างชำระ'];
    rows = data.deposits.map((r) => [
      r.code,
      r.fullName,
      r.status,
      r.depositStatus,
      r.depositBalance.toFixed(2),
      r.outstandingDebt.toFixed(2),
    ]);
  } else {
    headers = ['Idempotency Key', 'อ้างอิง', 'ชื่อช่าง', 'ประเภท', 'จำนวนเงิน (บาท)', 'สถานะ', 'เลขที่เอกสาร Oracle'];
    rows = data.oracleReconcile.map((r) => [
      r.idempotencyKey,
      r.bookingRef,
      r.technicianName,
      r.kind,
      r.amount.toFixed(2),
      r.status,
      r.oracleDocNo,
    ]);
  }

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join(
      '\r\n',
    );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bmt-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
