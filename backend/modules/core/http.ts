import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { getCorsHeaders } from '../../lib/cors';

/** Error type whose message is safe to show to the caller. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Authentication is required.') => new ApiError(401, message, 'unauthorized');
export const forbidden = (message = 'You are not allowed to perform this action.') => new ApiError(403, message, 'forbidden');
export const notFound = (message = 'Not found.') => new ApiError(404, message, 'not_found');
export const conflict = (message: string, details?: unknown) => new ApiError(409, message, 'conflict', details);
export const tooMany = (message = 'Too many requests. Please slow down.') => new ApiError(429, message, 'rate_limited');
export const unavailable = (message: string) => new ApiError(503, message, 'unavailable');

export type AuthedUser = { id: string; email: string | null; user: User };

let serviceClient: SupabaseClient | null = null;

/** Server-only Supabase client (service role). Never import this from the frontend. */
export function db(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(500, 'Server database configuration is missing.', 'config');
  serviceClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return serviceClient;
}

/** Test hook: lets unit tests inject a fake database client. */
export function __setDbForTests(client: SupabaseClient | null) {
  serviceClient = client;
}

const tokenCache = new Map<string, { user: User; expires: number }>();

export async function authenticate(request: Request): Promise<AuthedUser> {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length < 20 || token.length > 4096) throw unauthorized();
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return { id: cached.user.id, email: cached.user.email?.trim().toLowerCase() || null, user: cached.user };
  }
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw unauthorized('Your session is invalid or has expired. Please sign in again.');
  // Short cache to avoid one Supabase round trip per autosave; tokens are still
  // re-validated at least every 30 seconds.
  tokenCache.set(token, { user: data.user, expires: Date.now() + 30_000 });
  if (tokenCache.size > 2000) {
    const now = Date.now();
    for (const [key, value] of tokenCache) if (value.expires < now) tokenCache.delete(key);
  }
  return { id: data.user.id, email: data.user.email?.trim().toLowerCase() || null, user: data.user };
}

export async function readJson<S extends ZodTypeAny>(request: Request, schema: S, maxBytes = 256_000): Promise<ZodInfer<S>> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new ApiError(413, 'Request body is too large.', 'payload_too_large');
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw badRequest('Request body could not be read.');
  }
  if (text.length > maxBytes) throw new ApiError(413, 'Request body is too large.', 'payload_too_large');
  let raw: unknown = {};
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw badRequest('Request body must be valid JSON.');
    }
  }
  return parse(schema, raw);
}

export function parse<S extends ZodTypeAny>(schema: S, value: unknown): ZodInfer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest('Request validation failed.', formatZod(result.error));
  return result.data;
}

function formatZod(error: ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

export async function readForm(request: Request, maxBytes: number): Promise<FormData> {
  const length = Number(request.headers.get('content-length') || 0);
  if (!length) throw new ApiError(411, 'Uploads must declare their size.', 'length_required');
  if (length > maxBytes) throw new ApiError(413, `Upload exceeds the ${Math.round(maxBytes / 1_048_576)} MB limit.`, 'payload_too_large');
  try {
    return await request.formData();
  } catch {
    throw badRequest('Upload must be multipart/form-data.');
  }
}

export function json(request: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...getCorsHeaders(request.headers.get('origin')),
    ...extraHeaders,
  });
  return new Response(JSON.stringify(body), { status, headers });
}

export function errorResponse(request: Request, error: unknown): Response {
  if (error instanceof ApiError) {
    return json(request, { error: error.message, code: error.code, details: error.details }, error.status);
  }
  if (error instanceof ZodError) {
    const details = formatZod(error);
    return json(request, { error: details[0]?.message ? `Invalid input: ${details[0].message}` : 'Request validation failed.', code: 'bad_request', details }, 400);
  }
  // Never leak stack traces or database messages to the client.
  console.error('[api] unhandled error', error instanceof Error ? { message: error.message, stack: error.stack } : error);
  return json(request, { error: 'Something went wrong on our side. Please try again.', code: 'internal' }, 500);
}

/** Converts a Supabase/PostgREST error into an ApiError without exposing internals. */
export function dbFail(context: string, error: { message?: string; code?: string } | null | undefined): never {
  console.error(`[db] ${context}`, error?.code, error?.message);
  if (error?.code === '23505') throw conflict('This action conflicts with an existing record.');
  throw new ApiError(500, 'A database operation failed. Please try again.', 'database');
}

/* ------------------------------------------------------------------ */
/* Rate limiting (per serverless instance; complements DB-backed caps) */
/* ------------------------------------------------------------------ */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
  } else {
    bucket.count += 1;
    if (bucket.count > limit) throw tooMany();
  }
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function requireUuidParam(value: string | undefined, name: string): string {
  if (!isUuid(value)) throw badRequest(`${name} must be a valid identifier.`);
  return value.toLowerCase();
}
