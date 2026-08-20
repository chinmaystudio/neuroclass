import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authenticate teacher/session
    
    // 2. Proxy the frame to Render AI
    const baseUrl = process.env.AI_SERVICE_URL;
    const secret = process.env.AI_SERVICE_SECRET;
    
    const response = await fetch(`${baseUrl}/ai/v1/attendance/frame`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': req.headers['content-type'] as string,
      },
      body: req as any
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: "AI Service failed to process frame" });
    }
    
    const data = await response.json();
    
    // 3. Strip any sensitive vectors if they accidentally leak (Render strips them by default)
    // 4. Return bounding boxes and Match/Review/Unknown status to Cloudflare
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
