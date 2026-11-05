/**
 * Personal access tokens for the NeuroClass MCP endpoint and REST API.
 *
 * Shape: "nc_live_" + 32 random base32 characters. Only the SHA-256 hash is
 * stored; the plaintext is returned once from createToken() and never
 * reconstructible. Every lookup touches last_used_at so revoke-on-leak works.
 *
 * A token is exactly as powerful as its owner: everything the holder can do
 * is already enforced by RLS and the service-layer checks.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import { badRequest, db, dbFail, notFound, type AuthedUser } from '../core/http';

export type TokenRecord = { id: string; name: string; prefix: string; lastUsedAt: string | null; expiresAt: string | null; createdAt: string };
export const MAX_TOKENS_PER_USER = 20;

const createSchema = z.object({ name: z.string().trim().min(1).max(80), expiresInDays: z.number().int().min(1).max(365).optional() });

function newToken() {
  // Base32 (no 0/O/1/I) keeps tokens unambiguous when copied by hand; 32 chars
  // is 160 bits of entropy, which is plenty for an API token.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = randomBytes(32);
  let body = '';
  for (let i = 0; i < 32; i++) body += alphabet[random[i] % alphabet.length];
  const token = `nc_live_${body}`;
  return { token, prefix: `${token.slice(0, 16)}…`, hash: createHash('sha256').update(token).digest('hex') };
}

function hashToken(token: string) {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!/^nc_live_[A-Z0-9]{32}$/.test(trimmed)) return null;
  return createHash('sha256').update(trimmed).digest('hex');
}

export async function listTokens(user: AuthedUser): Promise<{ tokens: TokenRecord[] }> {
  const { data, error } = await db().from('api_tokens')
    .select('id,name,token_prefix,last_used_at,expires_at,revoked_at,created_at')
    .eq('user_id', user.id).is('revoked_at', null).order('created_at', { ascending: false });
  if (error) dbFail('list tokens', error);
  return { tokens: (data ?? []).map((r: any) => ({ id: r.id, name: r.name, prefix: r.token_prefix, lastUsedAt: r.last_used_at, expiresAt: r.expires_at, createdAt: r.created_at })) };
}

export async function createToken(user: AuthedUser, raw: unknown): Promise<TokenRecord & { token: string }> {
  const input = createSchema.parse(raw);
  const { count } = await db().from('api_tokens').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('revoked_at', null);
  if ((count ?? 0) >= MAX_TOKENS_PER_USER) throw badRequest(`You can have at most ${MAX_TOKENS_PER_USER} tokens. Revoke one you no longer need.`);
  const { token, prefix, hash } = newToken();
  const expires = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400_000).toISOString() : null;
  const { data, error } = await db().from('api_tokens')
    .insert({ user_id: user.id, name: input.name, token_hash: hash, token_prefix: prefix, expires_at: expires })
    .select('id,name,token_prefix,last_used_at,expires_at,created_at').single();
  if (error) dbFail('create token', error);
  return { id: data.id, name: data.name, prefix: data.token_prefix, lastUsedAt: null, expiresAt: data.expires_at, createdAt: data.created_at, token };
}

export async function revokeToken(user: AuthedUser, tokenId: string): Promise<{ revoked: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(tokenId)) throw badRequest('Invalid token id.');
  const { data, error } = await db().from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId).eq('user_id', user.id).is('revoked_at', null)
    .select('id');
  if (error) dbFail('revoke token', error);
  if (!data?.length) throw notFound('Token not found or already revoked.');
  return { revoked: true };
}

const userCache = new Map<string, { user: AuthedUser; expires: number }>();

/** Validates a presented token and returns the owner as an AuthedUser. Null on reject. */
export async function authenticateToken(tokenValue: string | null | undefined): Promise<AuthedUser | null> {
  const hash = hashToken(tokenValue ?? '');
  if (!hash) return null;
  const cached = userCache.get(hash);
  if (cached && cached.expires > Date.now()) return cached.user;
  const { data: row, error } = await db().from('api_tokens')
    .select('id,user_id,expires_at,revoked_at').eq('token_hash', hash).maybeSingle();
  if (error || !row) return null;
  const r = row as { id: string; user_id: string; expires_at: string | null; revoked_at: string | null };
  if (r.revoked_at) return null;
  if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) return null;
  const { data: profile } = await db().from('users').select('uid,email,displayname,role').eq('uid', r.user_id).maybeSingle();
  if (!profile) return null;
  const synthetic = {
    id: (profile as any).uid,
    email: (profile as any).email as string | null,
    user: {
      id: (profile as any).uid,
      email: (profile as any).email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: { role: (profile as any).role, displayname: (profile as any).displayname ?? undefined, full_name: (profile as any).displayname ?? undefined },
      created_at: '',
      updated_at: '',
    } as unknown as User,
  } as AuthedUser;
  userCache.set(hash, { user: synthetic, expires: Date.now() + 60_000 });
  // Non-blocking: record that the token is in use so revoke-on-leak works.
  void db().from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', r.id).then(
    () => undefined,
    (e) => console.warn('[tokens] last_used update failed', e?.message),
  );
  if (userCache.size > 500) {
    const now = Date.now();
    for (const [key, value] of userCache) if (value.expires < now) userCache.delete(key);
  }
  return synthetic;
}

export function __clearTokenCacheForTests() { userCache.clear(); }
