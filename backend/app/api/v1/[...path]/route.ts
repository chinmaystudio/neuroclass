import { dispatch } from '../../../../modules/router';

// Node runtime: the handlers use Buffer and the Supabase service client.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Coding evaluation on submit can take several sandbox round trips.
export const maxDuration = 60;

type Params = { params: { path: string[] } };
const handle = (request: Request, { params }: Params) => dispatch(request, params.path ?? []);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
