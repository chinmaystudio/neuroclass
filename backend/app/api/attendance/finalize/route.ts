import { NextResponse } from 'next/server';
import {
  GatewayError,
  getAuthorizedSession,
  jsonError,
  requireGatewayAuth,
  requireUuid,
  forwardMultipartToRender,
} from '../../../../lib/aiGateway';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireGatewayAuth(request);
    const body = await request.json();
    const sessionId = requireUuid(body.session_id, 'session_id');
    await getAuthorizedSession(auth, sessionId);
    const form = new FormData();
    form.append('session_id', sessionId);
    const response = await forwardMultipartToRender('/ai/v1/attendance/finish', form, ['session_id']);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return jsonError(error);
  }
}
