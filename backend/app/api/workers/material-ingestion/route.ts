import { NextResponse } from 'next/server';
import { runMaterialIngestion } from '../../../../services/materialIngestion';

export const runtime = 'nodejs';

function authorized(request: Request): boolean {
  const expected = process.env.MATERIAL_WORKER_SECRET || process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return Boolean(expected && provided && provided === expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return NextResponse.json({ error: 'Worker authorization is required.' }, { status: 401 });
  try {
    const limit = Number(new URL(request.url).searchParams.get('limit') || 5);
    const summary = await runMaterialIngestion(Number.isFinite(limit) ? limit : 5);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('[material-ingestion]', error);
    return NextResponse.json({ error: 'Material ingestion failed.' }, { status: 500 });
  }
}
