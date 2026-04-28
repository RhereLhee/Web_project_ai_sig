-- Add soft-delete support to User.
-- When a user deletes their account we set deletedAt and anonymise PII;
-- financial records (orders, commissions, withdrawals) are kept for accounting.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
