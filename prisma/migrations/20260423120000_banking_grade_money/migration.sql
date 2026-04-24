-- Banking-grade money system migration
-- Adds: LedgerEntry, WithdrawalAudit, IdempotencyKey, SlipVerification, BankTransaction
-- Adds: Order.expectedAmountSatang, amountSuffix, expiresAt, isFirstPayment
-- Adds: Commission.buyerId, parentCommissionId + unique constraint for first-payment rule
-- Removes: Commission.withdrawnAmount (replaced by split pattern)

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE "LedgerType" AS ENUM (
  'COMMISSION_CREDIT',
  'WITHDRAWAL_HOLD',
  'WITHDRAWAL_RELEASE',
  'WITHDRAWAL_DEBIT',
  'COMMISSION_REVERSAL',
  'ADJUSTMENT'
);

CREATE TYPE "SlipVerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'MATCHED',
  'UNMATCHED',
  'DUPLICATE'
);

-- ============================================
-- ORDER additions
-- ============================================

ALTER TABLE "Order"
  ADD COLUMN "expectedAmountSatang" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "amountSuffix" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "isFirstPayment" BOOLEAN NOT NULL DEFAULT true;

-- Backfill expectedAmountSatang = finalAmount for existing rows (no suffix retroactively)
UPDATE "Order" SET "expectedAmountSatang" = "finalAmount" WHERE "expectedAmountSatang" = 0;

CREATE INDEX "Order_expectedAmountSatang_status_idx" ON "Order"("expectedAmountSatang", "status");
CREATE INDEX "Order_expiresAt_idx" ON "Order"("expiresAt");

-- ============================================
-- COMMISSION: add buyerId + parent split + remove withdrawnAmount
-- ============================================

ALTER TABLE "Commission"
  ADD COLUMN "buyerId" TEXT,
  ADD COLUMN "parentCommissionId" TEXT;

-- Drop withdrawnAmount (superseded by split-commission pattern).
-- Safe: no existing data relies on it (previous flow didn't actually update it in production).
ALTER TABLE "Commission" DROP COLUMN IF EXISTS "withdrawnAmount";

CREATE INDEX "Commission_buyerId_userId_idx"          ON "Commission"("buyerId", "userId");
CREATE INDEX "Commission_affiliatePaymentId_userId_idx" ON "Commission"("affiliatePaymentId", "userId");
CREATE INDEX "Commission_parentCommissionId_idx"        ON "Commission"("parentCommissionId");

-- PARTIAL UNIQUE INDEXES:
-- These apply ONLY to "original" commissions (parentCommissionId IS NULL).
-- Split children (parentCommissionId IS NOT NULL) are exempt — they represent
-- portions of an already-distributed commission and may share (affiliatePaymentId, userId).

-- กัน double-distribute: one ORIGINAL commission per (order, upline)
CREATE UNIQUE INDEX "Commission_affiliatePaymentId_userId_original_key"
  ON "Commission"("affiliatePaymentId", "userId")
  WHERE "parentCommissionId" IS NULL;

-- First-payment-only: (buyer, upline) pair gets commission exactly once in its lifetime.
-- Only applies to ORIGINAL commissions with a buyerId set.
CREATE UNIQUE INDEX "Commission_buyerId_userId_original_key"
  ON "Commission"("buyerId", "userId")
  WHERE "parentCommissionId" IS NULL AND "buyerId" IS NOT NULL;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_parentCommissionId_fkey"
  FOREIGN KEY ("parentCommissionId") REFERENCES "Commission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- WITHDRAWAL AUDIT
-- ============================================

CREATE TABLE "WithdrawalAudit" (
  "id"           TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "fromStatus"   "WithdrawalStatus",
  "toStatus"     "WithdrawalStatus" NOT NULL,
  "actorId"      TEXT,
  "actorRole"    TEXT,
  "actorIp"      TEXT,
  "actorUa"      TEXT,
  "reason"       TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithdrawalAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WithdrawalAudit_withdrawalId_idx" ON "WithdrawalAudit"("withdrawalId");
CREATE INDEX "WithdrawalAudit_toStatus_idx"     ON "WithdrawalAudit"("toStatus");
CREATE INDEX "WithdrawalAudit_createdAt_idx"    ON "WithdrawalAudit"("createdAt");

ALTER TABLE "WithdrawalAudit"
  ADD CONSTRAINT "WithdrawalAudit_withdrawalId_fkey"
  FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- LEDGER ENTRY (immutable, append-only)
-- ============================================

CREATE TABLE "LedgerEntry" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "amount"       INTEGER NOT NULL,
  "type"         "LedgerType" NOT NULL,
  "refType"      TEXT NOT NULL,
  "refId"        TEXT NOT NULL,
  "withdrawalId" TEXT,
  "note"         TEXT,
  "createdBy"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");
CREATE INDEX "LedgerEntry_type_idx"              ON "LedgerEntry"("type");
CREATE INDEX "LedgerEntry_refType_refId_idx"     ON "LedgerEntry"("refType", "refId");
CREATE INDEX "LedgerEntry_withdrawalId_idx"      ON "LedgerEntry"("withdrawalId");

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_withdrawalId_fkey"
  FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ledger entries are immutable — enforce at DB level.
CREATE OR REPLACE FUNCTION prevent_ledger_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry rows are immutable; use INSERT only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_no_update BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_update();

-- ============================================
-- IDEMPOTENCY KEYS
-- ============================================

CREATE TABLE "IdempotencyKey" (
  "key"        TEXT NOT NULL,
  "scope"      TEXT NOT NULL,
  "response"   JSONB NOT NULL,
  "statusCode" INTEGER NOT NULL DEFAULT 200,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "IdempotencyKey_scope_idx"     ON "IdempotencyKey"("scope");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- ============================================
-- SLIP VERIFICATION
-- ============================================

CREATE TABLE "SlipVerification" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT,
  "userId"          TEXT NOT NULL,
  "fileUrl"         TEXT,
  "fileSha256"      TEXT NOT NULL,
  "provider"        TEXT NOT NULL DEFAULT 'slipok',
  "providerRef"     TEXT,
  "rawResponse"     JSONB,
  "amountSatang"    INTEGER,
  "senderBank"      TEXT,
  "senderName"      TEXT,
  "senderAccount"   TEXT,
  "receiverBank"    TEXT,
  "receiverName"    TEXT,
  "receiverAccount" TEXT,
  "transferAt"      TIMESTAMP(3),
  "status"          "SlipVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage"    TEXT,
  "reviewedBy"      TEXT,
  "reviewedAt"      TIMESTAMP(3),
  "reviewNote"      TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlipVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlipVerification_fileSha256_key"  ON "SlipVerification"("fileSha256");
CREATE UNIQUE INDEX "SlipVerification_providerRef_key" ON "SlipVerification"("providerRef");
CREATE INDEX "SlipVerification_orderId_idx"   ON "SlipVerification"("orderId");
CREATE INDEX "SlipVerification_userId_idx"    ON "SlipVerification"("userId");
CREATE INDEX "SlipVerification_status_idx"    ON "SlipVerification"("status");
CREATE INDEX "SlipVerification_createdAt_idx" ON "SlipVerification"("createdAt");

ALTER TABLE "SlipVerification"
  ADD CONSTRAINT "SlipVerification_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- BANK TRANSACTION (raw source of truth)
-- ============================================

CREATE TABLE "BankTransaction" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT,
  "bankRef"         TEXT NOT NULL,
  "amountSatang"    INTEGER NOT NULL,
  "receivedAt"      TIMESTAMP(3) NOT NULL,
  "senderBank"      TEXT,
  "senderAccount"   TEXT,
  "receiverBank"    TEXT,
  "receiverAccount" TEXT,
  "rawData"         JSONB,
  "source"          TEXT NOT NULL DEFAULT 'slipok',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankTransaction_orderId_key" ON "BankTransaction"("orderId");
CREATE UNIQUE INDEX "BankTransaction_bankRef_key" ON "BankTransaction"("bankRef");
CREATE INDEX "BankTransaction_amountSatang_receivedAt_idx" ON "BankTransaction"("amountSatang", "receivedAt");
CREATE INDEX "BankTransaction_receivedAt_idx" ON "BankTransaction"("receivedAt");

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- SEED: default SystemSetting keys for money config
-- (upsert so re-run is safe)
-- ============================================

INSERT INTO "SystemSetting" ("id", "key", "value", "label", "group", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'vip_price_satang',        '49900', 'ราคา VIP (satang)',             'money', NOW(), NOW()),
  (gen_random_uuid()::text, 'affiliate_pool_percent',  '30',    '% ของยอดออเดอร์ที่แจก upline', 'money', NOW(), NOW()),
  (gen_random_uuid()::text, 'min_withdraw_satang',     '30000', 'ขั้นต่ำถอน (satang)',           'money', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
