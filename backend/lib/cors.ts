import { NextResponse } from 'next/server';

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedStr = process.env.ALLOWED_ORIGINS || '';
  const allowed = allowedStr
    ? allowedStr.split(',').map(s => s.trim())
    : ['*'];

  let origin = '*';
  if (requestOrigin) {
    if (allowed.includes('*') || allowed.includes(requestOrigin) || !allowedStr) {
      origin = requestOrigin;
    } else if (allowed.length > 0) {
      origin = allowed[0];
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT, X-402-Version, payment-signature, x-payment',
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-402-Transaction-Id',
  };
}

export function withCors<T extends Response>(response: T, requestOrigin?: string | null): T {
  const headers = getCorsHeaders(requestOrigin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function handleOptions(request?: Request): Response {
  const origin = request?.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
}

