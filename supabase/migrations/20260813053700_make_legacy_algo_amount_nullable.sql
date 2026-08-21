-- x402 ledger compatibility cleanup
-- New payments settle in USDC ASA units; the legacy ALGO amount is no longer used.
-- Keep the historical column for compatibility, but allow new USDC rows to leave it NULL.

BEGIN;
ALTER TABLE public.x402_payments
  ALTER COLUMN amount_algo DROP NOT NULL;
COMMIT;
