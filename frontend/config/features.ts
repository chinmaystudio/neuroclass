/**
 * Feature switches read at build time (Cloudflare Pages env vars).
 *
 * Payments (x402 / Algorand / Stripe test mode) are TEMPORARILY DISABLED.
 * The payment code is kept in the repository so it can be restored by setting
 * VITE_PAYMENTS_ENABLED=true here and PAYMENTS_ENABLED=true on the backend.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const FEATURES = {
  payments: env.VITE_PAYMENTS_ENABLED === 'true',
} as const;
