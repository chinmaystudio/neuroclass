import { db, dbFail, forbidden, notFound, type AuthedUser } from './http';

export type ClassroomRow = { id: string; name: string; code?: string; subject?: string | null; user_id: string };
export type EnrollmentRow = { id: string; classroom_id: string; user_id: string | null; name: string; email: string | null; roll_number?: string | null; face_registration_status?: string | null };

export type ClassroomAccess =
  | { role: 'teacher'; classroom: ClassroomRow; enrollment: null }
  | { role: 'student'; classroom: ClassroomRow; enrollment: EnrollmentRow };

export async function getClassroom(classroomId: string): Promise<ClassroomRow> {
  const { data, error } = await db().from('classrooms').select('id,name,code,subject,user_id').eq('id', classroomId).maybeSingle();
  if (error) dbFail('classroom lookup', error);
  // Same response for "missing" and "not yours" so classroom IDs cannot be probed.
  if (!data) throw notFound('Classroom not found.');
  return data as ClassroomRow;
}

export async function findEnrollment(classroomId: string, user: AuthedUser): Promise<EnrollmentRow | null> {
  const columns = 'id,classroom_id,user_id,name,email,roll_number,face_registration_status';
  const byUser = await db().from('students').select(columns).eq('classroom_id', classroomId).eq('user_id', user.id).limit(1).maybeSingle();
  if (byUser.error) dbFail('enrollment lookup', byUser.error);
  if (byUser.data) return byUser.data as EnrollmentRow;
  if (!user.email) return null;
  // Legacy enrollments created before the user_id column was populated are matched
  // by the verified Supabase email only when they are not linked to another account.
  const byEmail = await db().from('students').select(columns).eq('classroom_id', classroomId).ilike('email', user.email).limit(1).maybeSingle();
  if (byEmail.error) dbFail('enrollment lookup', byEmail.error);
  const row = byEmail.data as EnrollmentRow | null;
  if (row && row.user_id && row.user_id !== user.id) return null;
  return row;
}

/** Resolves whether the caller is the classroom owner or an enrolled student. */
export async function resolveClassroomAccess(classroomId: string, user: AuthedUser): Promise<ClassroomAccess> {
  const classroom = await getClassroom(classroomId);
  if (classroom.user_id === user.id) return { role: 'teacher', classroom, enrollment: null };
  const enrollment = await findEnrollment(classroomId, user);
  if (enrollment) return { role: 'student', classroom, enrollment };
  throw notFound('Classroom not found.');
}

export async function requireTeacher(classroomId: string, user: AuthedUser) {
  const access = await resolveClassroomAccess(classroomId, user);
  if (access.role !== 'teacher') throw forbidden('Only the classroom teacher can do this.');
  return access;
}

export async function requireStudent(classroomId: string, user: AuthedUser) {
  const access = await resolveClassroomAccess(classroomId, user);
  if (access.role !== 'student') throw forbidden('Only enrolled students can do this.');
  return access as Extract<ClassroomAccess, { role: 'student' }>;
}

export async function audit(entry: { actor: string; classroomId?: string | null; entityType: string; entityId?: string | null; action: string; details?: Record<string, unknown> }) {
  const { error } = await db().from('assessment_audit_logs').insert({
    actor_user_id: entry.actor,
    classroom_id: entry.classroomId ?? null,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    details: entry.details ?? {},
  });
  // Auditing must never block the primary action, but failures are logged.
  if (error) console.error('[audit] insert failed', error.code, error.message);
}
