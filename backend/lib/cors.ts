import { NextResponse } from 'next/server';

/**
 * Origins allowed to call the API from a browser. ALLOWED_ORIGINS (comma
 * separated) overrides the defaults; entries may use one leading wildcard
 * label, e.g. https://*.neuroclass.pages.dev for Cloudflare preview builds.
 * Requests without an Origin header (server-to-server, native apps) are not
 * affected by CORS. Auth is a bearer token, never cookies, so CSRF does not apply.
 */
const DEFAULT_ORIGINS = [
  'https://neuroclass.pages.dev',
  'https://*.neuroclass.pages.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
];

function configuredOrigins(): string[] {
  const raw = (process.env.ALLOWED_ORIGINS || '').trim();
  if (!raw) return DEFAULT_ORIGINS;
  return raw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

export function isOriginAllowed(origin: string, allowed = configuredOrigins()): boolean {
  if (allowed.includes('*')) return true;
  const normalized = origin.replace(/\/$/, '').toLowerCase();
  return allowed.some((entry) => {
    const e = entry.toLowerCase();
    if (!e.includes('*')) return e === normalized;
    const match = /^(https?:\/\/)\*\.(.+)$/.exec(e);
    if (!match) return false;
    const [, scheme, base] = match;
    if (!normalized.startsWith(scheme)) return false;
    const host = normalized.slice(scheme.length);
    return host.endsWith(`.${base}`) && /^[a-z0-9-]+$/.test(host.slice(0, -(base.length + 1)));
  });
}

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-ID, PAYMENT-SIGNATURE, X-PAYMENT, X-402-Version, payment-signature, x-payment',
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-402-Transaction-Id, X-NC-Region',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  if (requestOrigin && isOriginAllowed(requestOrigin)) headers['Access-Control-Allow-Origin'] = requestOrigin;
  return headers;
}

export function withCors<T extends Response>(response: T, requestOrigin?: string | null): T {
  const headers = getCorsHeaders(requestOrigin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  if (!headers['Access-Control-Allow-Origin']) response.headers.delete('Access-Control-Allow-Origin');
  return response;
}

export function handleOptions(request?: Request): Response {
  const origin = request?.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
}
