import { handleMcp } from '../../../modules/mcp/server';

// Node runtime: the handler uses Buffer and the Supabase service client.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const region = process.env.VERCEL_REGION || 'local';

const handle = async (request: Request) => {
  const response = await handleMcp(request);
  response.headers.set('X-NC-Region', region);
  return response;
};

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
