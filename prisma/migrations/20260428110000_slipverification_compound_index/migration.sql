-- Compound index to speed up "latest SlipVerification per Order" subquery.
-- The admin orders page queries: WHERE orderId = $x ORDER BY createdAt DESC LIMIT 1
-- Without this, Postgres scans all rows for the orderId, then sorts. With it, it
-- uses an index-only scan and jumps straight to the newest row.
CREATE INDEX "SlipVerification_orderId_createdAt_idx" ON "SlipVerification"("orderId", "createdAt" DESC);
