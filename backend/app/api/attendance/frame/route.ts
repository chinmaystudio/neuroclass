import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '../../../../lib/cors';
import {
  assertTeacherOwnsClassroom,
  GatewayError,
  getAuthorizedSession,
  jsonError,
  persistObservations,
  requireGatewayAuth,
  requireUuid,
  sessionIsOpen,
  forwardMultipartToRender,
} from '../../../../lib/aiGateway';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireGatewayAuth(request);
    const form = await request.formData();
    const classroomId = requireUuid(form.get('classroom_id'), 'classroom_id');
    const sessionId = requireUuid(form.get('session_id'), 'session_id');
    const file = form.get('file');
    if (!(file instanceof File)) throw new GatewayError('file is required', 400);
    const session = await getAuthorizedSession(auth, sessionId);
    if (session.classroom_id !== classroomId) throw new GatewayError('Attendance session is not authorized for this classroom', 403);
    if (!sessionIsOpen(session)) throw new GatewayError('Attendance session is not active', 409);
    await assertTeacherOwnsClassroom(auth, classroomId);

    const renderResponse = await forwardMultipartToRender('/ai/v1/attendance/frame', form, ['classroom_id', 'session_id', 'file']);
    const data = await renderResponse.json().catch(() => ({}));
    if (!renderResponse.ok) return withCors(NextResponse.json({ error: 'AI Service failed to process frame', detail: data }, { status: renderResponse.status }), request.headers.get('origin'));
    data.results = await persistObservations(auth, sessionId, Array.isArray(data.results) ? data.results : []);
    return withCors(NextResponse.json(data), request.headers.get('origin'));
  } catch (error) {
    return jsonError(error, request);
  }
}
