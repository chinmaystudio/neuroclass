import { dispatch } from '../../../../modules/router';

// Node runtime: the handlers use Buffer and the Supabase service client.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Coding evaluation on submit can take several sandbox round trips.
export const maxDuration = 60;

type Params = { params: { path: string[] } };
// Report the serving region so latency problems (API far from the database)
// can be diagnosed from the browser.
const region = process.env.VERCEL_REGION || 'local';
const handle = async (request: Request, { params }: Params) => {
  const response = await dispatch(request, params.path ?? []);
  response.headers.set('X-NC-Region', region);
  return response;
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
