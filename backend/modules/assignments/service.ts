import { z } from 'zod';
import { badRequest, conflict, db, dbFail, durableRateLimit, forbidden, notFound, rateLimit, readForm, type AuthedUser } from '../core/http';
import { audit, requireTeacher, resolveClassroomAccess } from '../core/access';
import { putObject, removeObjects, signedDownload, SUPPORTED_EXTENSIONS, validateUpload } from '../core/storage';
import { LANGUAGE_IDS } from '../coding/languages';
import { getProvider, redactForStudent, runTestCases, type TestCaseRow } from '../coding/executor';
import { gradeCoding } from '../assessments/domain';

/* ------------------------------ Schemas ------------------------------ */
const latePolicySchema = z.object({
  allowLate: z.boolean().default(false),
  penaltyPercentPerDay: z.number().min(0).max(100).default(0),
  maxLateDays: z.number().int().min(0).max(60).default(0),
}).default({});

const assignmentSchema = z.object({
  title: z.string().trim().min(3).max(250),
  description: z.string().max(5000).optional().nullable(),
  instructions: z.string().max(20000).optional().nullable(),
  assignmentType: z.enum(['text', 'file', 'document', 'coding', 'mixed']).default('text'),
  availableFrom: z.string().datetime({ offset: true }).optional().nullable(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  totalMarks: z.number().min(0).max(10000).default(100),
  latePolicy: latePolicySchema,
  acceptedFileTypes: z.array(z.enum(SUPPORTED_EXTENSIONS as [string, ...string[]])).max(20).default(['pdf', 'docx', 'txt', 'png', 'jpg', 'zip']),
  maxFileSizeMb: z.number().int().min(1).max(50).default(10),
  maxFiles: z.number().int().min(0).max(20).default(5),
  allowResubmission: z.boolean().default(true),
  coding: z.object({
    languages: z.array(z.enum(LANGUAGE_IDS)).min(1),
    starterCode: z.record(z.string().max(20000)).default({}),
    timeLimitMs: z.number().int().min(500).max(10000).default(3000),
    memoryLimitMb: z.number().int().min(32).max(512).default(256),
  }).optional().nullable(),
  testCases: z.array(z.object({ input: z.string().max(65536).default(''), expectedOutput: z.string().max(65536).default(''), isHidden: z.boolean().default(true), weight: z.number().positive().max(100).default(1) })).max(50).optional(),
}).superRefine((a, ctx) => {
  if ((a.assignmentType === 'coding' || a.assignmentType === 'mixed') && !a.coding) ctx.addIssue({ code: 'custom', path: ['coding'], message: 'Choose at least one programming language.' });
  if (a.availableFrom && a.dueAt && new Date(a.availableFrom) >= new Date(a.dueAt)) ctx.addIssue({ code: 'custom', path: ['dueAt'], message: 'The due date must be after the start date.' });
});

const COLUMNS = 'id,classroom_id,created_by,title,description,instructions,assignment_type,status,available_from,due_at,total_marks,late_policy,accepted_file_types,max_file_size_mb,max_files,allow_resubmission,coding,created_at,updated_at,published_at';
type AssignmentRow = { id: string; classroom_id: string; title: string; description: string | null; instructions: string | null; assignment_type: string; status: string; available_from: string | null; due_at: string | null; total_marks: number; late_policy: { allowLate: boolean; penaltyPercentPerDay: number; maxLateDays: number }; accepted_file_types: string[]; max_file_size_mb: number; max_files: number; allow_resubmission: boolean; coding: any; created_at: string; updated_at: string; published_at: string | null };

const view = (a: AssignmentRow) => ({
  id: a.id, classroomId: a.classroom_id, title: a.title, description: a.description, instructions: a.instructions, assignmentType: a.assignment_type, status: a.status,
  availableFrom: a.available_from, dueAt: a.due_at, totalMarks: Number(a.total_marks), latePolicy: a.late_policy, acceptedFileTypes: a.accepted_file_types,
  maxFileSizeMb: a.max_file_size_mb, maxFiles: a.max_files, allowResubmission: a.allow_resubmission,
  coding: a.coding ? { languages: a.coding.languages, starterCode: a.coding.starterCode ?? {}, timeLimitMs: a.coding.timeLimitMs, memoryLimitMb: a.coding.memoryLimitMb } : null,
  createdAt: a.created_at, updatedAt: a.updated_at, publishedAt: a.published_at,
});

async function loadAssignment(id: string) {
  const { data, error } = await db().from('assignments').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) dbFail('load assignment', error);
  if (!data) throw notFound('Assignment not found.');
  return data as unknown as AssignmentRow;
}

async function assignmentWithAccess(id: string, user: AuthedUser) {
  const assignment = await loadAssignment(id);
  const access = await resolveClassroomAccess(assignment.classroom_id, user).catch(() => { throw notFound('Assignment not found.'); });
  if (access.role === 'student' && !['published', 'closed'].includes(assignment.status)) throw notFound('Assignment not found.');
  if (access.role === 'student' && assignment.available_from && new Date(assignment.available_from) > new Date()) throw notFound('Assignment not found.');
  return { assignment, access };
}

async function teacherAssignment(id: string, user: AuthedUser) {
  const r = await assignmentWithAccess(id, user);
  if (r.access.role !== 'teacher') throw forbidden('Only the classroom teacher can do this.');
  return r;
}

/** Late-day calculation: any part of a day late counts as one day. */
export function lateness(dueAt: string | null, submittedAt: Date, policy: AssignmentRow['late_policy']) {
  if (!dueAt) return { isLate: false, lateDays: 0, penaltyPercent: 0, allowed: true };
  const ms = submittedAt.getTime() - new Date(dueAt).getTime();
  if (ms <= 0) return { isLate: false, lateDays: 0, penaltyPercent: 0, allowed: true };
  const lateDays = Math.ceil(ms / 86_400_000);
  const allowed = Boolean(policy?.allowLate) && (!policy.maxLateDays || lateDays <= policy.maxLateDays);
  return { isLate: true, lateDays, penaltyPercent: Math.min(100, lateDays * (policy?.penaltyPercentPerDay ?? 0)), allowed };
}

/* ------------------------------ Teacher ------------------------------ */
export async function listAssignments(classroomId: string, user: AuthedUser) {
  const access = await resolveClassroomAccess(classroomId, user);
  let query = db().from('assignments').select(COLUMNS).eq('classroom_id', classroomId).order('created_at', { ascending: false }).limit(200);
  query = access.role === 'teacher' ? query.neq('status', 'archived') : query.in('status', ['published', 'closed']);
  const { data, error } = await query;
  if (error) dbFail('list assignments', error);
  let rows = (data ?? []) as unknown as AssignmentRow[];
  if (access.role === 'student') rows = rows.filter((a) => !a.available_from || new Date(a.available_from) <= new Date());
  const ids = rows.map((a) => a.id);
  if (!ids.length) return [];
  if (access.role === 'teacher') {
    const [{ data: subs }, { count: enrolled }] = await Promise.all([
      db().from('assignment_submissions').select('assignment_id,status,is_late').in('assignment_id', ids),
      db().from('students').select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId),
    ]);
    return rows.map((a) => {
      const mine = (subs ?? []).filter((s: any) => s.assignment_id === a.id);
      const submitted = mine.filter((s: any) => s.status !== 'draft');
      return { ...view(a), stats: { enrolled: enrolled ?? 0, submitted: submitted.length, late: submitted.filter((s: any) => s.is_late).length, evaluated: mine.filter((s: any) => ['evaluated', 'returned'].includes(s.status)).length, pending: Math.max(0, (enrolled ?? 0) - submitted.length) } };
    });
  }
  const { data: subs } = await db().from('assignment_submissions').select('assignment_id,status,final_score,submitted_at,is_late').in('assignment_id', ids).eq('student_user_id', user.id);
  return rows.map((a) => {
    const s: any = (subs ?? []).find((x: any) => x.assignment_id === a.id);
    const overdue = a.due_at && new Date(a.due_at) < new Date();
    return { ...view(a), mySubmission: s ? { status: s.status, submittedAt: s.submitted_at, isLate: s.is_late, finalScore: s.status === 'returned' ? s.final_score : null } : null, myStatus: s ? s.status : overdue ? 'missing' : 'not_started' };
  });
}

export async function createAssignment(classroomId: string, user: AuthedUser, raw: unknown) {
  await requireTeacher(classroomId, user);
  const input = assignmentSchema.parse(raw);
  const { data, error } = await db().from('assignments').insert({
    classroom_id: classroomId, created_by: user.id, title: input.title, description: input.description ?? null, instructions: input.instructions ?? null,
    assignment_type: input.assignmentType, available_from: input.availableFrom ?? null, due_at: input.dueAt ?? null, total_marks: input.totalMarks,
    late_policy: input.latePolicy, accepted_file_types: input.acceptedFileTypes, max_file_size_mb: input.maxFileSizeMb, max_files: input.maxFiles,
    allow_resubmission: input.allowResubmission, coding: input.coding ?? null, status: 'draft',
  }).select(COLUMNS).single();
  if (error) dbFail('create assignment', error);
  if (input.testCases?.length) await replaceAssignmentCases((data as any).id, input.testCases);
  await audit({ actor: user.id, classroomId, entityType: 'assignment', entityId: (data as any).id, action: 'create' });
  return getAssignment((data as any).id, user);
}

async function replaceAssignmentCases(assignmentId: string, cases: NonNullable<z.infer<typeof assignmentSchema>['testCases']>) {
  await db().from('coding_test_cases').delete().eq('assignment_id', assignmentId);
  if (!cases.length) return;
  const { error } = await db().from('coding_test_cases').insert(cases.map((c, i) => ({ assignment_id: assignmentId, position: i, input: c.input, expected_output: c.expectedOutput, is_hidden: c.isHidden, weight: c.weight })));
  if (error) dbFail('assignment cases', error);
}

export async function updateAssignment(id: string, user: AuthedUser, raw: unknown) {
  const { assignment } = await teacherAssignment(id, user);
  if (assignment.status === 'archived') throw conflict('Archived assignments cannot be edited.');
  const input = assignmentSchema.innerType().partial().parse(raw);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const map: Record<string, string> = { title: 'title', description: 'description', instructions: 'instructions', assignmentType: 'assignment_type', availableFrom: 'available_from', dueAt: 'due_at', totalMarks: 'total_marks', latePolicy: 'late_policy', acceptedFileTypes: 'accepted_file_types', maxFileSizeMb: 'max_file_size_mb', maxFiles: 'max_files', allowResubmission: 'allow_resubmission', coding: 'coding' };
  for (const [k, col] of Object.entries(map)) if ((input as any)[k] !== undefined) patch[col] = (input as any)[k];
  if (input.assignmentType && input.assignmentType !== assignment.assignment_type) {
    const { count } = await db().from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', id).neq('status', 'draft');
    if ((count ?? 0) > 0) throw conflict('Students have submitted work, so the assignment type can no longer change.');
  }
  const { error } = await db().from('assignments').update(patch).eq('id', id);
  if (error) dbFail('update assignment', error);
  if (input.testCases) await replaceAssignmentCases(id, input.testCases);
  await audit({ actor: user.id, classroomId: assignment.classroom_id, entityType: 'assignment', entityId: id, action: 'update', details: { fields: Object.keys(patch) } });
  return getAssignment(id, user);
}

export async function setAssignmentStatus(id: string, user: AuthedUser, action: 'publish' | 'unpublish' | 'close' | 'reopen' | 'archive') {
  const { assignment } = await teacherAssignment(id, user);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (action === 'publish') {
    if (!['draft', 'closed'].includes(assignment.status)) throw conflict('This assignment is already published.');
    if (['coding', 'mixed'].includes(assignment.assignment_type) && !assignment.coding?.languages?.length) throw badRequest('Choose at least one programming language before publishing.');
    Object.assign(patch, { status: 'published', published_at: assignment.published_at ?? now });
  } else if (action === 'unpublish') {
    const { count } = await db().from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', id);
    if ((count ?? 0) > 0) throw conflict('Students have already started this assignment. Close it instead.');
    patch.status = 'draft';
  } else if (action === 'close') patch.status = 'closed';
  else if (action === 'reopen') patch.status = 'published';
  else patch.status = 'archived';
  const { error } = await db().from('assignments').update(patch).eq('id', id);
  if (error) dbFail(`assignment ${action}`, error);
  await audit({ actor: user.id, classroomId: assignment.classroom_id, entityType: 'assignment', entityId: id, action });
  return getAssignment(id, user);
}

export async function deleteAssignment(id: string, user: AuthedUser) {
  const { assignment } = await teacherAssignment(id, user);
  if (assignment.status !== 'draft') throw conflict('Only drafts can be deleted. Archive published assignments instead.');
  const { data: atts } = await db().from('assignment_attachments').select('storage_path').eq('assignment_id', id);
  const { error } = await db().from('assignments').delete().eq('id', id);
  if (error) dbFail('delete assignment', error);
  await removeObjects((atts ?? []).map((a: any) => a.storage_path));
  await audit({ actor: user.id, classroomId: assignment.classroom_id, entityType: 'assignment', entityId: id, action: 'delete' });
  return { deleted: true };
}

export async function getAssignment(id: string, user: AuthedUser) {
  const { assignment, access } = await assignmentWithAccess(id, user);
  const [{ data: attachments }, { data: cases }] = await Promise.all([
    db().from('assignment_attachments').select('id,file_name,mime_type,size_bytes,created_at').eq('assignment_id', id).order('created_at'),
    // Students see only the visible sample cases; hidden cases stay on the server.
    access.role === 'teacher'
      ? db().from('coding_test_cases').select('id,input,expected_output,is_hidden,weight,position').eq('assignment_id', id).order('position')
      : db().from('coding_test_cases').select('id,input,expected_output,position').eq('assignment_id', id).eq('is_hidden', false).order('position'),
  ]);
  return {
    ...view(assignment), role: access.role,
    attachments: (attachments ?? []).map((a: any) => ({ id: a.id, name: a.file_name, mime: a.mime_type, size: Number(a.size_bytes), createdAt: a.created_at })),
    testCases: (cases ?? []).map((c: any) => ({ id: c.id, input: c.input, expectedOutput: c.expected_output, isHidden: c.is_hidden ?? false, weight: c.weight === undefined ? undefined : Number(c.weight) })),
  };
}

export async function uploadAttachment(id: string, user: AuthedUser, request: Request) {
  const { assignment } = await teacherAssignment(id, user);
  rateLimit(`upload:${user.id}`, 30, 60_000);
  await durableRateLimit('upload', user.id, 300, 3600);
  const form = await readForm(request, 26 * 1_048_576);
  const file = form.get('file') as File;
  const meta = await validateUpload(file, SUPPORTED_EXTENSIONS, 25 * 1_048_576);
  const { count } = await db().from('assignment_attachments').select('id', { count: 'exact', head: true }).eq('assignment_id', id);
  if ((count ?? 0) >= 20) throw conflict('An assignment can have at most 20 attachments.');
  const path = `classrooms/${assignment.classroom_id}/assignments/${id}/attachments/${crypto.randomUUID()}.${meta.ext}`;
  await putObject(path, file, meta.mime);
  const { data, error } = await db().from('assignment_attachments').insert({ assignment_id: id, classroom_id: assignment.classroom_id, storage_path: path, file_name: meta.name, mime_type: meta.mime, size_bytes: meta.size, uploaded_by: user.id }).select('id,file_name,mime_type,size_bytes,created_at').single();
  if (error) { await removeObjects([path]); dbFail('attachment row', error); }
  return { id: data.id, name: data.file_name, mime: data.mime_type, size: Number(data.size_bytes), createdAt: data.created_at };
}

export async function deleteAttachment(id: string, attachmentId: string, user: AuthedUser) {
  await teacherAssignment(id, user);
  const { data } = await db().from('assignment_attachments').select('id,storage_path').eq('id', attachmentId).eq('assignment_id', id).maybeSingle();
  if (!data) throw notFound('Attachment not found.');
  await db().from('assignment_attachments').delete().eq('id', attachmentId);
  await removeObjects([data.storage_path]);
  return { deleted: true };
}

export async function downloadAttachment(id: string, attachmentId: string, user: AuthedUser) {
  await assignmentWithAccess(id, user);
  const { data } = await db().from('assignment_attachments').select('storage_path,file_name').eq('id', attachmentId).eq('assignment_id', id).maybeSingle();
  if (!data) throw notFound('Attachment not found.');
  return signedDownload(data.storage_path, data.file_name);
}

/* ------------------------------ Student submissions ------------------------------ */
async function studentContext(id: string, user: AuthedUser) {
  const { assignment, access } = await assignmentWithAccess(id, user);
  if (access.role !== 'student') throw forbidden('Only enrolled students can submit.');
  return { assignment, enrollment: access.enrollment };
}

const SUB_COLUMNS = 'id,assignment_id,classroom_id,student_user_id,student_record_id,status,text_response,code,submitted_at,is_late,late_days,score,penalty_percent,final_score,feedback,evaluated_at,returned_at,revision,created_at,updated_at';

function submissionView(s: any, files: any[], includeGrades: boolean) {
  return {
    id: s.id, status: s.status, textResponse: s.text_response, code: s.code, submittedAt: s.submitted_at, isLate: s.is_late, lateDays: s.late_days, revision: s.revision, updatedAt: s.updated_at,
    files: files.map((f) => ({ id: f.id, name: f.file_name, mime: f.mime_type, size: Number(f.size_bytes), createdAt: f.created_at })),
    // Marks and feedback become visible to students only once the work is returned.
    ...(includeGrades ? { score: s.score, penaltyPercent: Number(s.penalty_percent ?? 0), finalScore: s.final_score, feedback: s.feedback, evaluatedAt: s.evaluated_at, returnedAt: s.returned_at } : {}),
  };
}

async function ensureDraft(assignment: AssignmentRow, user: AuthedUser, enrollmentId: string) {
  const { data: existing } = await db().from('assignment_submissions').select(SUB_COLUMNS).eq('assignment_id', assignment.id).eq('student_user_id', user.id).maybeSingle();
  if (existing) return existing as any;
  const { data, error } = await db().from('assignment_submissions').insert({ assignment_id: assignment.id, classroom_id: assignment.classroom_id, student_user_id: user.id, student_record_id: enrollmentId, status: 'draft' }).select(SUB_COLUMNS).single();
  if (error) {
    if (error.code === '23505') return (await db().from('assignment_submissions').select(SUB_COLUMNS).eq('assignment_id', assignment.id).eq('student_user_id', user.id).single()).data as any;
    dbFail('create submission', error);
  }
  return data as any;
}

function assertEditable(assignment: AssignmentRow, submission: any) {
  if (assignment.status !== 'published') throw conflict('This assignment is closed.');
  if (['evaluated', 'returned'].includes(submission.status)) throw conflict('Your work has already been evaluated.');
  if (submission.status !== 'draft' && !assignment.allow_resubmission) throw conflict('Resubmission is not allowed for this assignment.');
  const late = lateness(assignment.due_at, new Date(), assignment.late_policy);
  if (late.isLate && !late.allowed) throw conflict('The deadline has passed and late submissions are not accepted.');
}

export async function mySubmission(id: string, user: AuthedUser) {
  const { assignment } = await studentContext(id, user);
  const { data } = await db().from('assignment_submissions').select(SUB_COLUMNS).eq('assignment_id', id).eq('student_user_id', user.id).maybeSingle();
  if (!data) return { submission: null, assignment: view(assignment) };
  const { data: files } = await db().from('assignment_submission_files').select('id,file_name,mime_type,size_bytes,created_at').eq('submission_id', data.id).order('created_at');
  return { submission: submissionView(data, files ?? [], data.status === 'returned'), assignment: view(assignment) };
}

export async function saveDraft(id: string, user: AuthedUser, raw: unknown) {
  rateLimit(`draft:${user.id}`, 60, 60_000);
  const { assignment, enrollment } = await studentContext(id, user);
  const input = z.object({ textResponse: z.string().max(100_000).optional().nullable(), code: z.object({ language: z.enum(LANGUAGE_IDS), source: z.string().max(200_000) }).optional().nullable() }).parse(raw);
  if (input.code && !(assignment.coding?.languages ?? []).includes(input.code.language)) throw badRequest('That language is not allowed for this assignment.');
  const submission = await ensureDraft(assignment, user, enrollment.id);
  assertEditable(assignment, submission);
  // Saving after submission keeps the submitted copy untouched until the student resubmits.
  if (submission.status !== 'draft') {
    if (input.code) {
      const { saveAssignmentWorkspace } = await import('../coding/service');
      await saveAssignmentWorkspace(user, { assignmentId: id, ...input.code });
    }
    return { savedAt: new Date().toISOString(), workingCopyOnly: true };
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.textResponse !== undefined) patch.text_response = input.textResponse;
  if (input.code !== undefined) patch.code = input.code;
  const { error } = await db().from('assignment_submissions').update(patch).eq('id', submission.id);
  if (error) dbFail('save draft', error);
  return { savedAt: patch.updated_at };
}

export async function uploadSubmissionFile(id: string, user: AuthedUser, request: Request) {
  rateLimit(`upload:${user.id}`, 20, 60_000);
  await durableRateLimit('upload', user.id, 300, 3600);
  const { assignment, enrollment } = await studentContext(id, user);
  if (!['file', 'document', 'mixed'].includes(assignment.assignment_type)) throw badRequest('This assignment does not accept file uploads.');
  const submission = await ensureDraft(assignment, user, enrollment.id);
  assertEditable(assignment, submission);
  if (submission.status !== 'draft') throw conflict('Choose "Edit submission" before changing files.');
  const maxBytes = assignment.max_file_size_mb * 1_048_576;
  const form = await readForm(request, maxBytes + 64_000);
  const file = form.get('file') as File;
  const meta = await validateUpload(file, assignment.accepted_file_types, maxBytes);
  const { count } = await db().from('assignment_submission_files').select('id', { count: 'exact', head: true }).eq('submission_id', submission.id);
  if ((count ?? 0) >= assignment.max_files) throw conflict(`You can upload at most ${assignment.max_files} file${assignment.max_files === 1 ? '' : 's'}.`);
  const path = `classrooms/${assignment.classroom_id}/assignments/${id}/submissions/${user.id}/${crypto.randomUUID()}.${meta.ext}`;
  await putObject(path, file, meta.mime);
  const { data, error } = await db().from('assignment_submission_files').insert({ submission_id: submission.id, storage_path: path, file_name: meta.name, mime_type: meta.mime, size_bytes: meta.size }).select('id,file_name,mime_type,size_bytes,created_at').single();
  if (error) { await removeObjects([path]); dbFail('submission file row', error); }
  await db().from('assignment_submissions').update({ updated_at: new Date().toISOString() }).eq('id', submission.id);
  return { id: data.id, name: data.file_name, mime: data.mime_type, size: Number(data.size_bytes), createdAt: data.created_at };
}

export async function deleteSubmissionFile(id: string, fileId: string, user: AuthedUser) {
  const { assignment } = await studentContext(id, user);
  const { data: submission } = await db().from('assignment_submissions').select('id,status').eq('assignment_id', id).eq('student_user_id', user.id).maybeSingle();
  if (!submission) throw notFound('File not found.');
  assertEditable(assignment, submission);
  if (submission.status !== 'draft') throw conflict('Choose "Edit submission" before changing files.');
  const { data: file } = await db().from('assignment_submission_files').select('id,storage_path').eq('id', fileId).eq('submission_id', submission.id).maybeSingle();
  if (!file) throw notFound('File not found.');
  await db().from('assignment_submission_files').delete().eq('id', fileId);
  await removeObjects([file.storage_path]);
  return { deleted: true };
}

/** Re-opens a submitted (not yet evaluated) submission for editing before the deadline. */
export async function reopenMySubmission(id: string, user: AuthedUser) {
  const { assignment } = await studentContext(id, user);
  const { data: submission } = await db().from('assignment_submissions').select(SUB_COLUMNS).eq('assignment_id', id).eq('student_user_id', user.id).maybeSingle();
  if (!submission) throw notFound('Submission not found.');
  if (!['submitted', 'late'].includes(submission.status)) throw conflict('Only submitted work can be edited.');
  assertEditable(assignment, submission);
  await db().from('assignment_submission_history').insert({ submission_id: submission.id, revision: submission.revision, action: 'reopened', actor_user_id: user.id, snapshot: { textResponse: submission.text_response, code: submission.code, submittedAt: submission.submitted_at } });
  await db().from('assignment_submissions').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', submission.id);
  return mySubmission(id, user);
}

export async function submitMine(id: string, user: AuthedUser) {
  const { assignment, enrollment } = await studentContext(id, user);
  const submission = await ensureDraft(assignment, user, enrollment.id);
  if (submission.status !== 'draft') return { alreadySubmitted: true, ...(await mySubmission(id, user)) };
  assertEditable(assignment, submission);
  const { data: files } = await db().from('assignment_submission_files').select('id').eq('submission_id', submission.id);
  const hasText = Boolean(submission.text_response?.trim());
  const hasCode = Boolean(submission.code?.source?.trim());
  const hasFiles = (files ?? []).length > 0;
  const type = assignment.assignment_type;
  if (type === 'text' && !hasText) throw badRequest('Write your answer before submitting.');
  if ((type === 'file' || type === 'document') && !hasFiles) throw badRequest('Upload at least one file before submitting.');
  if (type === 'coding' && !hasCode) throw badRequest('Write your code before submitting.');
  if (type === 'mixed' && !hasText && !hasCode && !hasFiles) throw badRequest('Add an answer, code or a file before submitting.');
  const now = new Date();
  const late = lateness(assignment.due_at, now, assignment.late_policy);
  const revision = (submission.revision ?? 0) + 1;
  // Conditional update guarantees a single submission even with double clicks.
  const { data: updated, error } = await db().from('assignment_submissions').update({ status: late.isLate ? 'late' : 'submitted', submitted_at: now.toISOString(), is_late: late.isLate, late_days: late.lateDays, penalty_percent: late.penaltyPercent, revision, updated_at: now.toISOString() }).eq('id', submission.id).eq('status', 'draft').select('id');
  if (error) dbFail('submit assignment', error);
  if (!updated?.length) return { alreadySubmitted: true, ...(await mySubmission(id, user)) };
  await db().from('assignment_submission_history').insert({ submission_id: submission.id, revision, action: 'submitted', actor_user_id: user.id, snapshot: { textResponse: submission.text_response, code: submission.code, fileCount: (files ?? []).length, isLate: late.isLate } });
  await audit({ actor: user.id, classroomId: assignment.classroom_id, entityType: 'assignment_submission', entityId: submission.id, action: 'submit', details: { late: late.isLate, revision } });
  return { alreadySubmitted: false, ...(await mySubmission(id, user)) };
}

export async function downloadMyFile(id: string, fileId: string, user: AuthedUser) {
  await studentContext(id, user);
  const { data: submission } = await db().from('assignment_submissions').select('id').eq('assignment_id', id).eq('student_user_id', user.id).maybeSingle();
  if (!submission) throw notFound('File not found.');
  const { data: file } = await db().from('assignment_submission_files').select('storage_path,file_name').eq('id', fileId).eq('submission_id', submission.id).maybeSingle();
  if (!file) throw notFound('File not found.');
  return signedDownload(file.storage_path, file.file_name);
}

/* ------------------------------ Teacher review ------------------------------ */
export async function listSubmissions(id: string, user: AuthedUser) {
  const { assignment } = await teacherAssignment(id, user);
  const [{ data: subs }, { data: roster }] = await Promise.all([
    db().from('assignment_submissions').select(SUB_COLUMNS).eq('assignment_id', id).order('submitted_at', { ascending: false, nullsFirst: false }),
    db().from('students').select('id,name,email,roll_number,user_id').eq('classroom_id', assignment.classroom_id).order('name'),
  ]);
  const ids = (subs ?? []).map((s: any) => s.id);
  const { data: files } = ids.length ? await db().from('assignment_submission_files').select('id,submission_id,file_name,mime_type,size_bytes,created_at').in('submission_id', ids) : { data: [] as any[] };
  const bySubmission = new Map<string, any[]>();
  (files ?? []).forEach((f: any) => bySubmission.set(f.submission_id, [...(bySubmission.get(f.submission_id) ?? []), f]));
  const subByStudent = new Map((subs ?? []).map((s: any) => [s.student_record_id ?? s.student_user_id, s]));
  return {
    assignment: view(assignment),
    students: (roster ?? []).map((st: any) => {
      const s: any = subByStudent.get(st.id) ?? (subs ?? []).find((x: any) => x.student_user_id === st.user_id);
      return { student: { id: st.id, name: st.name, email: st.email, rollNumber: st.roll_number }, submission: s ? submissionView(s, bySubmission.get(s.id) ?? [], true) : null };
    }),
  };
}

async function teacherSubmission(submissionId: string, user: AuthedUser) {
  const { data: s } = await db().from('assignment_submissions').select(SUB_COLUMNS).eq('id', submissionId).maybeSingle();
  if (!s) throw notFound('Submission not found.');
  const { assignment } = await teacherAssignment(s.assignment_id, user);
  return { submission: s as any, assignment };
}

export async function getSubmission(submissionId: string, user: AuthedUser) {
  const { submission, assignment } = await teacherSubmission(submissionId, user);
  const [{ data: files }, { data: history }, { data: student }] = await Promise.all([
    db().from('assignment_submission_files').select('id,file_name,mime_type,size_bytes,created_at').eq('submission_id', submissionId),
    db().from('assignment_submission_history').select('revision,action,created_at,snapshot').eq('submission_id', submissionId).order('created_at', { ascending: false }).limit(50),
    submission.student_record_id ? db().from('students').select('id,name,email,roll_number').eq('id', submission.student_record_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { assignment: view(assignment), student, submission: submissionView(submission, files ?? [], true), history: history ?? [] };
}

export async function downloadSubmissionFile(submissionId: string, fileId: string, user: AuthedUser) {
  await teacherSubmission(submissionId, user);
  const { data: file } = await db().from('assignment_submission_files').select('storage_path,file_name').eq('id', fileId).eq('submission_id', submissionId).maybeSingle();
  if (!file) throw notFound('File not found.');
  return signedDownload(file.storage_path, file.file_name);
}

export async function gradeSubmission(submissionId: string, user: AuthedUser, raw: unknown) {
  const { submission, assignment } = await teacherSubmission(submissionId, user);
  const input = z.object({ score: z.number().min(0).max(10000), feedback: z.string().max(10000).optional().nullable(), returnToStudent: z.boolean().default(true), waiveLatePenalty: z.boolean().default(false) }).parse(raw);
  if (submission.status === 'draft') throw conflict('The student has not submitted this work yet.');
  if (input.score > Number(assignment.total_marks)) throw badRequest(`Score cannot exceed ${assignment.total_marks}.`);
  const penalty = input.waiveLatePenalty ? 0 : Number(submission.penalty_percent ?? 0);
  const finalScore = Math.round(input.score * (1 - penalty / 100) * 100) / 100;
  const now = new Date().toISOString();
  const { error } = await db().from('assignment_submissions').update({ score: input.score, penalty_percent: penalty, final_score: finalScore, feedback: input.feedback ?? null, evaluated_by: user.id, evaluated_at: now, status: input.returnToStudent ? 'returned' : 'evaluated', returned_at: input.returnToStudent ? now : null, updated_at: now }).eq('id', submissionId);
  if (error) dbFail('grade submission', error);
  await db().from('assignment_submission_history').insert({ submission_id: submissionId, revision: submission.revision, action: input.returnToStudent ? 'returned' : 'evaluated', actor_user_id: user.id, snapshot: { score: input.score, finalScore, feedback: input.feedback ?? null } });
  await audit({ actor: user.id, classroomId: assignment.classroom_id, entityType: 'assignment_submission', entityId: submissionId, action: 'grade', details: { score: input.score, finalScore } });
  return getSubmission(submissionId, user);
}

/** Runs the teacher-defined test cases (hidden included) against a submission's code. */
export async function evaluateSubmissionCode(submissionId: string, user: AuthedUser) {
  const { submission, assignment } = await teacherSubmission(submissionId, user);
  if (!submission.code?.source) throw badRequest('This submission has no code.');
  const { data: cases } = await db().from('coding_test_cases').select('id,input,expected_output,is_hidden,weight').eq('assignment_id', assignment.id).order('position');
  if (!cases?.length) throw badRequest('Add test cases to this assignment first.');
  const { results, compileError } = await runTestCases(getProvider(), submission.code.language, submission.code.source, cases as TestCaseRow[], { timeLimitMs: assignment.coding?.timeLimitMs ?? 3000, memoryLimitMb: assignment.coding?.memoryLimitMb ?? 256 });
  const suggestion = gradeCoding(Number(assignment.total_marks), results);
  return { compileError, results, passed: results.filter((r) => r.passed).length, total: results.length, suggestedScore: suggestion.score };
}

export { redactForStudent };
