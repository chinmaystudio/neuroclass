import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendToRenderAI } from '../../src/lib/ai-service';

export const config = {
  api: {
    bodyParser: false, // Required for multipart/form-data proxying
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Authenticate user (pseudo-code: replace with actual Supabase JWT check)
    // const user = await verifyAuth(req);
    
    // 2. We need to forward the raw multipart request to Render.
    // In Vercel serverless, passing the raw request body to node-fetch requires careful handling.
    // For a robust implementation, we parse it using 'formidable' or pass it directly if supported.
    
    // As a simple proxy pass-through (assuming the client sent valid FormData):
    const baseUrl = process.env.AI_SERVICE_URL;
    const secret = process.env.AI_SERVICE_SECRET;
    
    const response = await fetch(`${baseUrl}/ai/v1/enrollment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': req.headers['content-type'] as string,
      },
      body: req as any // Stream the raw request body
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: "AI Service rejected the enrollment" });
    }
    
    const data = await response.json();
    
    // 3. Write metadata to Supabase (pseudo-code)
    // if (data.success) { await supabase.from('face_profiles').upsert(...) }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
