-- Update VIP price from ฿499 (49900 satang) to ฿599 (59900 satang).
-- Referred users get a ฿100 discount applied at checkout; the base price
-- stored here is always the non-discounted rack rate.
UPDATE "SystemSetting"
SET value = '59900'
WHERE key = 'vip_price_satang'
  AND value = '49900';

-- Insert the setting if it doesn't exist yet (fresh databases).
INSERT INTO "SystemSetting" (id, key, value, "updatedAt")
SELECT gen_random_uuid()::text, 'vip_price_satang', '59900', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "SystemSetting" WHERE key = 'vip_price_satang'
);
