import { NextResponse } from 'next/server';
import { flushOutbox } from '../../../../modules/notifications/notify';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return Boolean(expected && provided && provided === expected);
}

/** Retries notification emails that could not be sent at publish time. */
export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return NextResponse.json({ error: 'Worker authorization is required.' }, { status: 401 });
  try {
    const summary = await flushOutbox({ limit: 1000, deadlineMs: 50_000 });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('[notifications-worker]', error);
    return NextResponse.json({ error: 'Notification retry failed.' }, { status: 500 });
  }
}
