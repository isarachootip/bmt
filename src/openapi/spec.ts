export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary: string; tags: string[] }>>;
}

export function buildOpenApiSpec(): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {
      title: 'BMT – Technician Payment Service API',
      version: '1.0.0',
      description:
        'เอกสาร OpenAPI สำหรับระบบ BMT บริหารเงินค้ำประกัน แบ่งจ่ายค่างาน 90/10 อนุมัติจ่ายแบบ SoD และเชื่อมต่อ INT, CRM, Oracle, LON (Line OA)',
    },
    paths: {
      '/api/auth/login': {
        get: { summary: 'ดึงข้อมูลผู้ใช้ปัจจุบันและรายชื่อบทบาท', tags: ['Auth'] },
        post: { summary: 'เข้าสู่ระบบพนักงาน หรือสลับบทบาททดสอบ SoD', tags: ['Auth'] },
      },
      '/api/auth/logout': {
        post: { summary: 'ออกจากระบบ', tags: ['Auth'] },
      },
      '/api/webhooks/int/technician-approved': {
        post: {
          summary: 'Webhook รับช่างที่ผ่าน Approve จากระบบ INT (Idempotent ด้วย technicianCode)',
          tags: ['Webhooks - INT'],
        },
      },
      '/api/webhooks/crm/close-job': {
        post: {
          summary: 'Webhook รับยืนยัน Close Job จาก CRM คำนวณงวด 90/10 อัตโนมัติ (Idempotent ด้วย bookingNo+taskCode)',
          tags: ['Webhooks - CRM'],
        },
      },
      '/api/technicians': {
        get: { summary: 'รายการบัญชีช่าง ยอดเงินค้ำประกัน และลิงก์ Statement มือถือ', tags: ['Technicians'] },
      },
      '/api/technicians/deposit': {
        post: { summary: 'บันทึกรับหลักฐานเงินค้ำประกัน/Top-up และยืนยันเป็น ACTIVE พร้อมแจ้ง INT', tags: ['Technicians'] },
      },
      '/api/technicians/{code}': {
        get: { summary: 'รายละเอียดความเคลื่อนไหว Ledger รายช่าง และตรวจสอบสิทธิ์คืนเงินค้ำประกัน', tags: ['Technicians'] },
        post: { summary: 'แจ้งพ้นสภาพ (OFFBOARDING) หรือสร้างคำขอคืนเงินค้ำประกัน', tags: ['Technicians'] },
      },
      '/api/close-jobs': {
        get: { summary: 'ประวัติการรับ Event Close Job และ Raw Payload จาก CRM', tags: ['Close Job'] },
      },
      '/api/approvals': {
        get: { summary: 'คิวรายการรออนุมัติ (งวดแรก / ปล่อย Hold / คืนเงินค้ำประกัน)', tags: ['Approvals'] },
        post: { summary: 'อนุมัติหรือปฏิเสธรายการ/ชุดรายการ ภายใต้กฎ SoD และวงเงิน 50,000 บาท', tags: ['Approvals'] },
      },
      '/api/retention': {
        get: { summary: 'รายการเงินประกันผลงาน (Hold 10%) และสถานะเคลม', tags: ['Retention & Claims'] },
        post: { summary: 'รัน Scheduler ปล่อย Hold รายวัน เปิดเคลม หรือปิดเคลมพร้อมหัก Cascade', tags: ['Retention & Claims'] },
      },
      '/api/oracle': {
        get: { summary: 'ติดตามสถานะการส่ง Payment Request ไป Oracle และ Log การ Retry', tags: ['Oracle'] },
        post: { summary: 'กดส่งซ้ำรายการ SYNC_FAILED กระทบยอด Reconcile หรือสลับโหมดจำลอง', tags: ['Oracle'] },
      },
      '/api/statement/{token}': {
        get: { summary: 'ข้อมูล Statement มือถือเฉพาะบุคคลของช่าง (ตรวจสอบด้วย HMAC Signed Token)', tags: ['Mobile Statement'] },
      },
      '/api/reports': {
        get: { summary: 'ข้อมูล Dashboard และรายงานการเงินทั้ง 4 มุมมอง', tags: ['Reports'] },
      },
      '/api/audit': {
        get: { summary: 'ค้นหาประวัติ Immutable Audit Log', tags: ['Audit'] },
      },
      '/api/settings': {
        get: { summary: 'อ่านค่าตั้งค่าระบบและกติกาแบ่งจ่ายตามประเภทงาน', tags: ['Settings'] },
        put: { summary: 'บันทึกการตั้งค่าระบบ (เฉพาะบทบาท ADMIN)', tags: ['Settings'] },
      },
    },
  };
}
