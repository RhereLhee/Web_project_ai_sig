-- Switch from first-payment-only to recurring commission model.
-- Drop the (buyerId, userId) partial unique index so the same buyer-upline
-- pair can receive commission on every purchase, not just the first.
-- The (affiliatePaymentId, userId) index stays — it prevents double-distribute
-- within a single order approval.

DROP INDEX IF EXISTS "Commission_buyerId_userId_original_key";
