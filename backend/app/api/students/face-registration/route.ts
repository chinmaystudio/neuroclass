import { NextResponse } from 'next/server';
import { handleOptions, withCors } from '../../../../lib/cors';
import {
  assertTeacherOrStudentCanRegister,
  GatewayError,
  jsonError,
  requireGatewayAuth,
  requireUuid,
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
    const studentId = requireUuid(form.get('student_id'), 'student_id');
    const classroomId = requireUuid(form.get('classroom_id'), 'classroom_id');
    await assertTeacherOrStudentCanRegister(auth, studentId, classroomId);
    const files = form.getAll('files').filter((value): value is File => value instanceof File);
    if (files.length < 1 || files.length > 10) throw new GatewayError('Provide between 1 and 10 face samples', 400);

    const response = await forwardMultipartToRender('/ai/v1/enrollment', form, ['student_id', 'classroom_id', 'registration_session_id', 'files']);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return withCors(NextResponse.json({ error: 'AI Service rejected the enrollment', detail: data }, { status: response.status }), request.headers.get('origin'));

    if (data.success) {
      const acceptedSamples = Number(data.accepted_samples || 0);
      const { data: existing } = await auth.db.from('face_profiles').select('id,profile_version,enrollment_count,verified_count').eq('student_id', studentId).eq('classroom_id', classroomId).maybeSingle();
      const { error } = await auth.db.from('face_profiles').upsert({
        ...(existing?.id ? { id: existing.id } : {}),
        student_id: studentId,
        classroom_id: classroomId,
        status: 'REGISTERED',
        profile_version: existing?.profile_version || Number(data.profile_version || 1),
        enrollment_count: Number(existing?.enrollment_count || 0) + acceptedSamples,
        verified_count: Number(existing?.verified_count || 0),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,classroom_id' });
      if (error) throw new GatewayError('Unable to persist face profile metadata', 500);
      const { error: studentStatusError } = await auth.db.from('students').update({ face_registration_status: 'REGISTERED' }).eq('id', studentId).eq('classroom_id', classroomId);
      if (studentStatusError) throw new GatewayError('Unable to update student registration status', 500);
    }

    return withCors(NextResponse.json({
      success: Boolean(data.success),
      status: data.success ? 'accepted' : 'rejected',
      student_id: studentId,
      profile_status: data.success ? 'active' : 'pending_review',
      accepted_samples: Number(data.accepted_samples || 0),
      rejected_samples: Number(data.rejected_samples || 0),
      rejection_reasons: data.rejection_reasons || [],
    }, { status: response.status }), request.headers.get('origin'));
  } catch (error) {
    return jsonError(error, request);
  }
}
