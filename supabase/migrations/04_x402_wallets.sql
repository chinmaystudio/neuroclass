-- Migration: 04_x402_wallets
-- Purpose: Persist x402 Algorand Testnet wallets per user

CREATE TABLE IF NOT EXISTS public.user_wallets (
  user_id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  mnemonic TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own wallet
CREATE POLICY "Users can view their own wallet"
  ON public.user_wallets
  FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can only insert their own wallet
CREATE POLICY "Users can insert their own wallet"
  ON public.user_wallets
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can only update their own wallet (if necessary)
CREATE POLICY "Users can update their own wallet"
  ON public.user_wallets
  FOR UPDATE
  USING (auth.uid()::text = user_id);
