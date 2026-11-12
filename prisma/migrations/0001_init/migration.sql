-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ExternalSystem" AS ENUM ('INT', 'CRM', 'ORACLE', 'LON');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PAYMENT_OFFICER', 'APPROVER', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('Q', 'R', 'MA');

-- CreateEnum
CREATE TYPE "DispatchCadence" AS ENUM ('IMMEDIATE', 'DAILY_1600', 'WEEKLY');

-- CreateEnum
CREATE TYPE "CloseJobIntakeResult" AS ENUM ('ACCEPTED', 'DUPLICATE_UPDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DbStage1Status" AS ENUM ('CALCULATED', 'WAIT_APPROVAL', 'APPROVED', 'REJECTED', 'SENT_TO_ORACLE', 'ORACLE_APPROVED', 'PAID', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "DbStage2Status" AS ENUM ('RETAINED', 'HOLD', 'DUE', 'DEDUCTED_FULL', 'WAIT_APPROVAL', 'APPROVED', 'REJECTED', 'SENT_TO_ORACLE', 'ORACLE_APPROVED', 'PAID', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "PayableKind" AS ENUM ('STAGE1', 'STAGE2', 'DEPOSIT_REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'CLOSED_NO_DAMAGE', 'CLOSED_DEDUCTED');

-- CreateEnum
CREATE TYPE "DbTechnicianStatus" AS ENUM ('PENDING_DEPOSIT', 'ACTIVE', 'SUSPENDED', 'OFFBOARDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "DbDepositStatus" AS ENUM ('AWAITING', 'RECEIVED', 'VERIFIED', 'PARTIAL_DEDUCTED', 'TOPUP_RECEIVED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DepositTxKind" AS ENUM ('INITIAL', 'TOPUP', 'CLAIM_DEDUCTION', 'REFUND');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('DEPOSIT_IN', 'DEPOSIT_TOPUP', 'CLAIM_DEDUCT_HOLD', 'CLAIM_DEDUCT_DEPOSIT', 'DEBT_RECORDED', 'DEBT_SETTLED', 'STAGE1_PAYOUT', 'STAGE2_PAYOUT', 'DEPOSIT_REFUND', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityRef" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "targetSystem" "ExternalSystem" NOT NULL,
    "direction" "IntegrationDirection" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "httpStatus" INTEGER NOT NULL,
    "requestBody" TEXT NOT NULL,
    "responseBody" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRuleConfig" (
    "id" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "stage1Percent" DECIMAL(5,2) NOT NULL DEFAULT 90.00,
    "stage2Percent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "warrantyDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRuleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "requiredDeposit" DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
    "approverLimit" DECIMAL(12,2) NOT NULL DEFAULT 50000.00,
    "dispatchCadence" "DispatchCadence" NOT NULL DEFAULT 'IMMEDIATE',
    "oracleSimMode" TEXT NOT NULL DEFAULT 'NORMAL',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloseJobEvent" (
    "id" TEXT NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "technicianCode" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "qcStatus" TEXT NOT NULL,
    "confirmedBy" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "result" "CloseJobIntakeResult" NOT NULL,
    "rejectReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloseJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPayment" (
    "id" TEXT NOT NULL,
    "bookingNo" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "technicianId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "snapshotStage1Pct" DECIMAL(5,2) NOT NULL,
    "snapshotStage2Pct" DECIMAL(5,2) NOT NULL,
    "snapshotWarrantyDays" INTEGER NOT NULL,
    "stage1Amount" DECIMAL(12,2) NOT NULL,
    "stage2InitialAmount" DECIMAL(12,2) NOT NULL,
    "stage2RemainingAmount" DECIMAL(12,2) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "warrantyEndAt" TIMESTAMP(3) NOT NULL,
    "stage1Status" "DbStage1Status" NOT NULL DEFAULT 'WAIT_APPROVAL',
    "stage2Status" "DbStage2Status" NOT NULL DEFAULT 'RETAINED',
    "confirmedByCustSat" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayableItem" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" "PayableKind" NOT NULL,
    "technicianId" TEXT NOT NULL,
    "jobPaymentId" TEXT,
    "bookingRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "DbStage1Status" NOT NULL DEFAULT 'WAIT_APPROVAL',
    "createdByUserId" TEXT,
    "decidedByUserId" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "oracleDocNo" TEXT,
    "oracleAttempts" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "claimNo" TEXT NOT NULL,
    "jobPaymentId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "damageAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "deductedFromHold" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "deductedFromDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "recordedDebt" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "status" "DbTechnicianStatus" NOT NULL DEFAULT 'PENDING_DEPOSIT',
    "supplierCode" TEXT,
    "bankName" TEXT NOT NULL,
    "bankAccountEnc" TEXT NOT NULL,
    "bankAccountMask" TEXT NOT NULL,
    "taxIdEnc" TEXT NOT NULL,
    "taxIdMask" TEXT NOT NULL,
    "depositBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "depositStatus" "DbDepositStatus" NOT NULL DEFAULT 'AWAITING',
    "outstandingDebt" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "intApprovedAt" TIMESTAMP(3) NOT NULL,
    "offboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositTransaction" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "kind" "DepositTxKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "evidenceRef" TEXT,
    "recordedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_entityRef_idx" ON "AuditLog"("entityRef");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_targetSystem_createdAt_idx" ON "IntegrationLog"("targetSystem", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationLog_idempotencyKey_idx" ON "IntegrationLog"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JobRuleConfig_jobType_key" ON "JobRuleConfig"("jobType");

-- CreateIndex
CREATE INDEX "CloseJobEvent_bookingNo_taskCode_idx" ON "CloseJobEvent"("bookingNo", "taskCode");

-- CreateIndex
CREATE INDEX "JobPayment_technicianId_idx" ON "JobPayment"("technicianId");

-- CreateIndex
CREATE INDEX "JobPayment_stage2Status_warrantyEndAt_idx" ON "JobPayment"("stage2Status", "warrantyEndAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobPayment_bookingNo_taskCode_key" ON "JobPayment"("bookingNo", "taskCode");

-- CreateIndex
CREATE UNIQUE INDEX "PayableItem_idempotencyKey_key" ON "PayableItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayableItem_status_kind_idx" ON "PayableItem"("status", "kind");

-- CreateIndex
CREATE INDEX "PayableItem_technicianId_idx" ON "PayableItem"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_claimNo_key" ON "WarrantyClaim"("claimNo");

-- CreateIndex
CREATE INDEX "WarrantyClaim_jobPaymentId_status_idx" ON "WarrantyClaim"("jobPaymentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_code_key" ON "Technician"("code");

-- CreateIndex
CREATE INDEX "DepositTransaction_technicianId_idx" ON "DepositTransaction"("technicianId");

-- CreateIndex
CREATE INDEX "LedgerEntry_technicianId_createdAt_idx" ON "LedgerEntry"("technicianId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobPayment" ADD CONSTRAINT "JobPayment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayableItem" ADD CONSTRAINT "PayableItem_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayableItem" ADD CONSTRAINT "PayableItem_jobPaymentId_fkey" FOREIGN KEY ("jobPaymentId") REFERENCES "JobPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_jobPaymentId_fkey" FOREIGN KEY ("jobPaymentId") REFERENCES "JobPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositTransaction" ADD CONSTRAINT "DepositTransaction_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enforce AuditLog Immutability (M10: ห้ามแก้ไขหรือลบ)
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog is immutable: % operation is prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
