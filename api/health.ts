import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const aiUrl = process.env.AI_SERVICE_URL;
  let ai: unknown = { status: 'not_configured' };

  if (aiUrl) {
    try {
      const response = await fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(5000) });
      ai = await response.json();
    } catch {
      ai = { status: 'unavailable' };
    }
  }

  return res.status(200).json({ status: 'ok', service: 'neuroclass-api', ai });
}
