import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // TODO: Validate the authenticated teacher and classroom membership with Supabase.
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const sessionId = body.session_id || randomUUID();

  return res.status(201).json({
    session_id: sessionId,
    classroom_id: body.classroom_id,
    status: 'ACTIVE',
    started_at: new Date().toISOString(),
  });
}
