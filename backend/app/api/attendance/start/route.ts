import { NextResponse } from 'next/server';
import {
  assertTeacherOwnsClassroom,
  GatewayError,
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
    const classroomId = requireUuid(body.classroom_id, 'classroom_id');
    const sessionId = requireUuid(body.session_id, 'session_id');
    await assertTeacherOwnsClassroom(auth, classroomId);
    const form = new FormData();
    form.append('classroom_id', classroomId);
    form.append('session_id', sessionId);
    const response = await forwardMultipartToRender('/ai/v1/attendance/start', form, ['classroom_id', 'session_id']);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return jsonError(error);
  }
}
