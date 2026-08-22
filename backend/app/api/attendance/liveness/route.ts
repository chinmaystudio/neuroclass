import { NextResponse } from 'next/server';
import {
  assertStudentInAttendanceSession,
  GatewayError,
  jsonError,
  requireGatewayAuth,
  requireUuid,
  forwardMultipartToRender,
} from '../../../../lib/aiGateway';
import { withCors } from '../../../../lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request): Promise<Response> {
  return withCors(new Response(null, { status: 204 }), request.headers.get('origin'));
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireGatewayAuth(request);
    const form = await request.formData();
    const classroomId = requireUuid(form.get('classroom_id'), 'classroom_id');
    const sessionId = requireUuid(form.get('session_id'), 'session_id');
    const studentId = requireUuid(form.get('student_id'), 'student_id');
    const file = form.get('file');
    if (!(file instanceof File)) throw new GatewayError('file is required', 400);
    await assertStudentInAttendanceSession(auth, studentId, classroomId, sessionId);
    form.set('liveness_required', 'true');
    const providerPath = process.env.AI_LIVENESS_PATH || '/ai/v1/liveness';
    const response = await forwardMultipartToRender(providerPath, form, ['classroom_id', 'session_id', 'student_id', 'challenge', 'liveness_required', 'file']);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return withCors(NextResponse.json({ error: 'Liveness service failed to process the frame', detail: data }, { status: response.status }), request.headers.get('origin'));
    const passed = data?.liveness_verified === true || data?.liveness_passed === true;
    return withCors(NextResponse.json({
      success: passed,
      status: passed ? 'passed' : 'review',
      liveness_verified: passed,
      liveness_score: typeof data?.liveness_score === 'number' ? data.liveness_score : null,
      challenge: data?.challenge || null,
      provider: data?.provider || 'configured-ai-service',
    }, { status: passed ? 200 : 422 }), request.headers.get('origin'));
  } catch (error) {
    return jsonError(error, request);
  }
}
