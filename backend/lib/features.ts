/**
 * Server feature switches.
 *
 * Payments (x402 / Algorand settlement and Stripe test checkout) are
 * TEMPORARILY DISABLED. The implementation stays in the repository; set
 * PAYMENTS_ENABLED=true (and VITE_PAYMENTS_ENABLED=true on the frontend) to
 * restore it.
 */
export const paymentsEnabled = () => process.env.PAYMENTS_ENABLED === 'true';
