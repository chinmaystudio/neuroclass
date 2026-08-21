import { NextResponse } from 'next/server';
import {
  GatewayError,
  getAuthorizedSession,
  jsonError,
  requireGatewayAuth,
  requireUuid,
} from '../../../../lib/aiGateway';

export const runtime = 'nodejs';

const DECISION_MAP: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {
  PRESENT: 'PRESENT',
  CONFIRM: 'PRESENT',
  ABSENT: 'ABSENT',
  REJECT: 'ABSENT',
  LATE: 'LATE',
};

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await requireGatewayAuth(request);
    const body = await request.json();
    const sessionId = requireUuid(body.session_id, 'session_id');
    const observationId = requireUuid(body.observation_id, 'observation_id');
    const decision = DECISION_MAP[String(body.decision || '').toUpperCase()];
    if (!decision) throw new GatewayError('decision must be PRESENT, ABSENT, LATE, CONFIRM, or REJECT', 400);

    const session = await getAuthorizedSession(auth, sessionId);
    const { data: observation, error: observationError } = await auth.db
      .from('attendance_observations')
      .select('id,session_id,student_id,confidence')
      .eq('id', observationId)
      .eq('session_id', sessionId)
      .maybeSingle();
    if (observationError || !observation) throw new GatewayError('Attendance observation not found', 404);

    const studentId = body.student_id ? requireUuid(body.student_id, 'student_id') : observation.student_id;
    if (studentId) {
      const { data: student, error: studentError } = await auth.db.from('students').select('id').eq('id', studentId).eq('classroom_id', session.classroom_id).maybeSingle();
      if (studentError || !student) throw new GatewayError('student_id is not enrolled in this classroom', 400);
    }

    const { error: updateError } = await auth.db.from('attendance_observations').update({ student_id: studentId || null, status: decision, verification_method: 'MANUAL' }).eq('id', observationId).eq('session_id', sessionId);
    if (updateError) throw new GatewayError('Unable to persist review decision', 500);

    if (studentId && decision !== 'ABSENT') {
      const { error } = await auth.db.from('attendance').upsert({
        session_id: sessionId,
        classroom_id: session.classroom_id,
        student_id: studentId,
        status: decision === 'LATE' ? 'Late' : 'Present',
        confidence: observation.confidence,
        verification_method: 'MANUAL',
      }, { onConflict: 'session_id,student_id' });
      if (error) throw new GatewayError('Unable to persist reviewed attendance', 500);
    }

    return NextResponse.json({ session_id: sessionId, observation_id: observationId, decision, student_id: studentId || null, status: 'REVIEW_RECORDED' });
  } catch (error) {
    return jsonError(error);
  }
}
