-- NeuroClass security cleanup
-- The application is non-custodial and no longer uses this legacy table.
-- This migration permanently removes any stored custodial wallet secrets and rows.

BEGIN;
DROP TABLE IF EXISTS public.user_wallets;
COMMIT;
