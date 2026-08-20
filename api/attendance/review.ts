import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // TODO: Validate teacher authorization and persist the review decision to Supabase.
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  if (!body.session_id || !body.observation_id || !body.decision) {
    return res.status(400).json({ error: 'session_id, observation_id, and decision are required' });
  }

  return res.status(200).json({
    session_id: body.session_id,
    observation_id: body.observation_id,
    decision: body.decision,
    status: 'REVIEW_RECORDED',
  });
}
