import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // TODO: Validate the authenticated teacher and write final attendance to Supabase.
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  if (!body.session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  return res.status(200).json({
    session_id: body.session_id,
    status: 'FINALIZED',
    finalized_at: new Date().toISOString(),
  });
}
