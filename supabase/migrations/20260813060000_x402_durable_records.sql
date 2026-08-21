-- Durable server records migration for x402 Target Architecture
BEGIN;

-- 1. Payment Attempt Record: Correlates mobile/web client payment request to server attempt
CREATE TABLE IF NOT EXISTS public.x402_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS x402_payment_attempts_resource_user_idx
  ON public.x402_payment_attempts (resource_id, user_id);
CREATE INDEX IF NOT EXISTS x402_payment_attempts_status_idx
  ON public.x402_payment_attempts (status);

-- 2. Learning Entitlements: Grants access to paid AI assessment content post-settlement
CREATE TABLE IF NOT EXISTS public.x402_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  settlement_tx_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'refunded')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS x402_entitlements_resource_subject_idx
  ON public.x402_entitlements (resource_id, subject_id);

-- 3. Refund Cases: Tracks post-settlement AI failures for operator resolution
CREATE TABLE IF NOT EXISTS public.x402_refund_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_tx_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  failure_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'processed')),
  operator_notes TEXT,
  refund_tx_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS x402_refund_cases_settlement_idx
  ON public.x402_refund_cases (settlement_tx_id);

-- Enable RLS (Service role managed)
ALTER TABLE public.x402_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x402_refund_cases ENABLE ROW LEVEL SECURITY;

COMMIT;
