import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '../../../../lib/cors';
import {
  assertTeacherOwnsClassroom,
  GatewayError,
  getAuthorizedSession,
  jsonError,
  materializeManualPresentAttendance,
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

    form.set('liveness_required', 'true');
    const renderResponse = await forwardMultipartToRender('/ai/v1/attendance/frame', form, ['classroom_id', 'session_id', 'capture_mode', 'liveness_required', 'file']);
    const data = await renderResponse.json().catch(() => ({}));
    if (!renderResponse.ok) return withCors(NextResponse.json({ error: 'AI Service failed to process frame', detail: data }, { status: renderResponse.status }), request.headers.get('origin'));
    const rawResults = Array.isArray(data.results) ? data.results : [];
    data.results = await persistObservations(auth, sessionId, rawResults.map((result: any) => {
      const livenessVerified = result?.liveness_verified === true || result?.liveness_passed === true;
      return livenessVerified
        ? { ...result, liveness_status: 'passed', verification: result.verification || 'render_arcface_liveness' }
        : { ...result, status: result.status === 'PRESENT' ? 'LIVENESS_REVIEW' : result.status, liveness_status: 'failed', verification: 'liveness_required' };
    }));
    if (String(form.get('capture_mode') || 'live') === 'manual') {
      data.results = await materializeManualPresentAttendance(auth, session, data.results);
    }
    return withCors(NextResponse.json(data), request.headers.get('origin'));
  } catch (error) {
    return jsonError(error, request);
  }
}
