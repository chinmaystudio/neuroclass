import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../database/supabase';
import { withCors } from './cors';

export async function requireAuth(request: NextRequest): Promise<{ userId: string } | { response: NextResponse }> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length < 20 || token.length > 4096) {
    return { response: withCors(NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })) };
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { response: withCors(NextResponse.json({ error: 'Authentication is invalid or expired.' }, { status: 401 })) };
  }
  return { userId: data.user.id };
}

export const boundedString = (value: unknown, maxLength: number, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
};

export const boundedJsonSize = (value: unknown, maxBytes: number) => {
  try {
    return JSON.stringify(value).length <= maxBytes;
  } catch {
    return false;
  }
};

export const parseImageDataUrl = (value: string) => {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match || match[2].length > 10_000_000) return null;
  return { mimeType: match[1].toLowerCase(), data: match[2] };
};
