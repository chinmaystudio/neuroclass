/**
 * MCP tool catalogue. Every tool wraps an existing service function so the
 * same RLS, enrolment checks and input schemas apply as in the website.
 * Tools are grouped by audience (teacher, student, shared) and the handler
 * refuses tools that don't match the caller's role.
 */
import { db, forbidden, type AuthedUser } from '../core/http';
import * as teacher from '../assessments/teacher';
import * as student from '../assessments/student';
import * as assignments from '../assignments/service';

type Json = Record<string, unknown>;
type Role = 'teacher' | 'student' | 'any';
export type Tool = {
  name: string;
  description: string;
  audience: Role;
  inputSchema: Json;
  handler: (user: AuthedUser, args: Json, roleOf: (u: AuthedUser) => Promise<'teacher' | 'student' | null>) => Promise<unknown>;
};

const uuid = (description = 'A NeuroClass identifier (UUID).') => ({ type: 'string', format: 'uuid', description });
const optional = (schema: Json) => ({ ...schema, nullable: true });

const TOOLS: Tool[] = [
  /* -------------------------- Shared -------------------------- */
  {
    name: 'whoami',
    description: 'Return the signed-in account used by this token: user id, email, display name and role.',
    audience: 'any',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler(user) {
      const { data } = await db().from('users').select('displayname,role,email_notifications').eq('uid', user.id).maybeSingle();
      return { userId: user.id, email: user.email, displayName: (data as any)?.displayname ?? null, role: (data as any)?.role ?? null, emailNotifications: (data as any)?.email_notifications !== false };
    },
  },
  {
    name: 'list_my_classrooms',
    description: 'For a teacher: classrooms they own. For a student: classrooms they are enrolled in. Returns id, name, class code and roster size.',
    audience: 'any',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler(user, _args, roleOf) {
      const role = await roleOf(user);
      if (role === 'teacher') {
        const { data } = await db().from('classrooms').select('id,name,subject,code,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
        const rooms = (data ?? []) as Array<{ id: string; name: string; subject: string | null; code: string; created_at: string }>;
        const ids = rooms.map((c) => c.id);
        const counts = new Map<string, number>();
        if (ids.length) {
          const { data: roster } = await (db().from('students') as any).select('id,classroom_id').in('classroom_id', ids).range(0, 9999);
          (roster ?? []).forEach((r: { classroom_id: string }) => counts.set(r.classroom_id, (counts.get(r.classroom_id) ?? 0) + 1));
        }
        return { role: 'teacher', classrooms: rooms.map((c) => ({ id: c.id, name: c.name, subject: c.subject, code: c.code, studentCount: counts.get(c.id) ?? 0, createdAt: c.created_at })) };
      }
      const { data: enrolments } = await db().from('students').select('classroom_id,joined_at').eq('user_id', user.id).limit(500);
      const ids = [...new Set((enrolments ?? []).map((r: any) => r.classroom_id).filter(Boolean))];
      const { data: rooms } = ids.length ? await db().from('classrooms').select('id,name,subject,code').in('id', ids) : { data: [] as any[] };
      const joined = new Map((enrolments ?? []).map((r: any) => [r.classroom_id, r.joined_at]));
      return { role: 'student', classrooms: (rooms ?? []).map((c: any) => ({ id: c.id, name: c.name, subject: c.subject, code: c.code, joinedAt: joined.get(c.id) ?? null })) };
    },
  },

  /* -------------------------- Teacher -------------------------- */
  {
    name: 'create_classroom',
    description: 'Teacher only: create a new classroom. Returns the generated six-character class code students will use to join.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, subject: optional({ type: 'string', maxLength: 120 }) } },
    async handler(user, args) {
      const name = String((args as any).name).trim();
      const subject = ((args as any).subject ?? null) as string | null;
      if (!name) throw { status: 400, message: 'name is required' };
      const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const { data, error } = await db().from('classrooms').insert({ name, subject, code, user_id: user.id, status: 'Active' }).select('id,name,subject,code,created_at').single();
      if (error) throw { status: 400, message: error.message };
      return data;
    },
  },
  {
    name: 'get_classroom',
    description: 'Teacher only: full details of one of their classrooms, including its join code and roster (name, email, roll number, Face ID status).',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['classroom_id'], additionalProperties: false, properties: { classroom_id: uuid() } },
    async handler(user, args) {
      const id = String((args as any).classroom_id);
      const { data: cls } = await db().from('classrooms').select('id,name,subject,code,status,created_at').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (!cls) throw { status: 404, message: 'Classroom not found.' };
      const { data: roster } = await (db().from('students') as any).select('id,name,email,roll_number,face_registration_status,joined_at').eq('classroom_id', id).order('name');
      return { ...(cls as any), students: roster ?? [] };
    },
  },
  {
    name: 'list_tests',
    description: 'Teacher only: list every test in a classroom (draft, scheduled, live, closed and archived), with id, title, status, schedule and submission stats.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['classroom_id'], additionalProperties: false, properties: { classroom_id: uuid() } },
    async handler(user, args) {
      return teacher.listTeacherTests(String((args as any).classroom_id), user);
    },
  },
  {
    name: 'create_test',
    description: 'Teacher only: create a draft test. Optionally pass questions and publish=true to create, fill and publish in one call. Question types: mcq, multiple_select, true_false, numerical, short_answer, long_answer, fill_blank, file_upload, coding. For mcq/multiple_select/true_false, set each option\'s isCorrect. For numerical, set numericAnswer (and optional numericTolerance). For short_answer, set acceptedAnswers (list of strings).',
    audience: 'teacher',
    inputSchema: {
      type: 'object', required: ['classroom_id', 'title'], additionalProperties: false,
      properties: {
        classroom_id: uuid(),
        title: { type: 'string', minLength: 3, maxLength: 250 },
        instructions: optional({ type: 'string', maxLength: 10000 }),
        durationMinutes: { type: 'integer', minimum: 1, maximum: 24 * 60, default: 30 },
        passingMarks: optional({ type: 'number', minimum: 0 }),
        examMode: { type: 'string', enum: ['standard', 'coding'], default: 'standard' },
        scheduledStart: optional({ type: 'string', format: 'date-time' }),
        scheduledEnd: optional({ type: 'string', format: 'date-time' }),
        security: {
          type: 'object', additionalProperties: true,
          properties: { requireFullscreen: { type: 'boolean' }, requireCamera: { type: 'boolean' }, requireIdentityVerification: { type: 'boolean' }, liveProctoring: { type: 'boolean' }, livenessCheck: { type: 'boolean' }, tabSwitchDetection: { type: 'boolean' }, blockClipboard: { type: 'boolean' } },
        },
        questions: { type: 'array', items: { type: 'object', additionalProperties: true } },
        publish: { type: 'boolean', default: false, description: 'When true, publish immediately after saving questions.' },
      },
    },
    async handler(user, args) {
      const { classroom_id, questions, publish, ...rest } = args as Json;
      const created = await teacher.createTest(String(classroom_id), user, rest);
      const summary = created as any;
      if (Array.isArray(questions) && questions.length) await teacher.replaceQuestions(summary.id, user, questions);
      if (publish) {
        const published = await teacher.publishTest(summary.id, user, { scheduledStart: (rest as any).scheduledStart ?? null, scheduledEnd: (rest as any).scheduledEnd ?? null });
        return published;
      }
      return summary;
    },
  },
  {
    name: 'replace_test_questions',
    description: 'Teacher only: replace the question list of a draft test.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['test_id', 'questions'], additionalProperties: false, properties: { test_id: uuid(), questions: { type: 'array', items: { type: 'object' } } } },
    async handler(user, args) { return teacher.replaceQuestions(String((args as any).test_id), user, (args as any).questions); },
  },
  {
    name: 'publish_test',
    description: 'Teacher only: publish a draft test. Students in the classroom are emailed (unless they have opted out).',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['test_id'], additionalProperties: false, properties: { test_id: uuid(), scheduledStart: optional({ type: 'string', format: 'date-time' }), scheduledEnd: optional({ type: 'string', format: 'date-time' }) } },
    async handler(user, args) { return teacher.publishTest(String((args as any).test_id), user, args); },
  },
  {
    name: 'change_test_status',
    description: 'Teacher only: unpublish, close, reopen or archive a test.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['test_id', 'action'], additionalProperties: false, properties: { test_id: uuid(), action: { type: 'string', enum: ['unpublish', 'close', 'reopen', 'archive'] } } },
    async handler(user, args) { return teacher.setTestStatus(String((args as any).test_id), user, (args as any).action); },
  },
  {
    name: 'get_test_results',
    description: 'Teacher only: per-attempt scores, class metrics, per-question averages and whether results have been released.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['test_id'], additionalProperties: false, properties: { test_id: uuid() } },
    async handler(user, args) { return teacher.testResults(String((args as any).test_id), user); },
  },
  {
    name: 'grade_attempt',
    description: 'Teacher only: grade an attempt\'s written or file-upload questions. Pass each question_id with manual_score and optional feedback. Objective questions are already marked.',
    audience: 'teacher',
    inputSchema: {
      type: 'object', required: ['attempt_id', 'grades'], additionalProperties: false,
      properties: {
        attempt_id: uuid(),
        grades: { type: 'array', items: { type: 'object', required: ['question_id', 'manual_score'], properties: { question_id: uuid(), manual_score: { type: 'number', minimum: 0 }, feedback: { type: 'string', maxLength: 5000 } }, additionalProperties: false } },
      },
    },
    async handler(user, args) {
      const grades = ((args as any).grades as any[]).map((g) => ({ questionId: g.question_id, manualScore: g.manual_score, feedback: g.feedback }));
      return teacher.gradeAttempt(String((args as any).attempt_id), user, { grades });
    },
  },
  {
    name: 'release_test_results',
    description: 'Teacher only: show or hide the results of a test from students. Students are emailed when results are released.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['test_id', 'released'], additionalProperties: false, properties: { test_id: uuid(), released: { type: 'boolean' } } },
    async handler(user, args) { return teacher.releaseResults(String((args as any).test_id), user, { released: (args as any).released }); },
  },
  {
    name: 'list_assignments',
    description: 'Teacher only: list every assignment in a classroom with status, due date and submission counts.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['classroom_id'], additionalProperties: false, properties: { classroom_id: uuid() } },
    async handler(user, args) { return { assignments: await assignments.listAssignments(String((args as any).classroom_id), user) }; },
  },
  {
    name: 'create_assignment',
    description: 'Teacher only: create a draft assignment (text, file, document, coding or mixed). Pass publish=true to publish right away; students are emailed when an assignment is published.',
    audience: 'teacher',
    inputSchema: {
      type: 'object', required: ['classroom_id', 'title'], additionalProperties: false,
      properties: {
        classroom_id: uuid(),
        title: { type: 'string', minLength: 3, maxLength: 250 },
        description: optional({ type: 'string', maxLength: 10000 }),
        instructions: optional({ type: 'string', maxLength: 10000 }),
        assignmentType: { type: 'string', enum: ['text', 'file', 'document', 'coding', 'mixed'], default: 'file' },
        totalMarks: { type: 'number', minimum: 0, maximum: 1000, default: 10 },
        dueAt: optional({ type: 'string', format: 'date-time' }),
        acceptedFileTypes: { type: 'array', items: { type: 'string' } },
        allowResubmission: { type: 'boolean' },
        publish: { type: 'boolean', default: false },
      },
    },
    async handler(user, args) {
      const { classroom_id, publish, ...rest } = args as Json;
      const created = await assignments.createAssignment(String(classroom_id), user, rest);
      if (publish) return assignments.setAssignmentStatus((created as any).id, user, 'publish');
      return created;
    },
  },
  {
    name: 'change_assignment_status',
    description: 'Teacher only: publish, unpublish, close, reopen or archive an assignment.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['assignment_id', 'action'], additionalProperties: false, properties: { assignment_id: uuid(), action: { type: 'string', enum: ['publish', 'unpublish', 'close', 'reopen', 'archive'] } } },
    async handler(user, args) { return assignments.setAssignmentStatus(String((args as any).assignment_id), user, (args as any).action); },
  },
  {
    name: 'list_assignment_submissions',
    description: 'Teacher only: list every submission for an assignment (student, status, grade, submitted-at).',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['assignment_id'], additionalProperties: false, properties: { assignment_id: uuid() } },
    async handler(user, args) { return assignments.listSubmissions(String((args as any).assignment_id), user); },
  },
  {
    name: 'grade_submission',
    description: 'Teacher only: grade one assignment submission. Pass marks and optional feedback.',
    audience: 'teacher',
    inputSchema: { type: 'object', required: ['submission_id', 'marks'], additionalProperties: false, properties: { submission_id: uuid(), marks: { type: 'number', minimum: 0 }, feedback: { type: 'string', maxLength: 5000 } } },
    async handler(user, args) { return assignments.gradeSubmission(String((args as any).submission_id), user, { marks: (args as any).marks, feedback: (args as any).feedback }); },
  },

  /* -------------------------- Student -------------------------- */
  {
    name: 'join_classroom',
    description: 'Student only: join a classroom using the six-character class code the teacher shared.',
    audience: 'student',
    inputSchema: { type: 'object', required: ['code'], additionalProperties: false, properties: { code: { type: 'string', minLength: 4, maxLength: 20 }, name: optional({ type: 'string', maxLength: 120 }), roll_number: optional({ type: 'string', maxLength: 40 }) } },
    async handler(user, args) {
      const code = String((args as any).code).trim().toUpperCase();
      const name = String((args as any).name ?? user.email ?? '').trim();
      if (name.length < 2 || name.length > 120) throw { status: 400, message: 'Enter your full name (2-120 characters).' };
      const { data: cls } = await db().from('classrooms').select('id,name,user_id').eq('code', code).maybeSingle();
      if (!cls) throw { status: 404, message: 'Classroom not found. Verify the 6-character code.' };
      if ((cls as any).user_id === user.id) throw { status: 400, message: 'You teach this classroom.' };
      const { data: existing } = await db().from('students').select('id').eq('classroom_id', (cls as any).id).eq('user_id', user.id).limit(1);
      if (existing && existing.length) throw { status: 409, message: 'You are already enrolled in this classroom.' };
      const roll = ((args as any).roll_number ?? null) as string | null;
      const { data: inserted, error } = await db().from('students').insert({ classroom_id: (cls as any).id, user_id: user.id, name, roll_number: roll, email: user.email }).select('id').single();
      if (error) throw { status: 400, message: error.message };
      return { joined: { classroom_id: (cls as any).id, classroom_name: (cls as any).name, student_id: (inserted as any).id } };
    },
  },
  {
    name: 'list_my_tests',
    description: 'Student only: every test in classrooms you have joined, with availability, duration, marks and (if released) your score.',
    audience: 'student',
    inputSchema: { type: 'object', additionalProperties: false, properties: { classroom_id: optional(uuid()) } },
    async handler(user, args) {
      const id = (args as any).classroom_id as string | undefined;
      if (id) return { tests: await student.listStudentTests(String(id), user) };
      return { tests: await student.listAllStudentTests(user) };
    },
  },
  {
    name: 'get_my_result',
    description: 'Student only: your released result for one attempt (score, per-question breakdown).',
    audience: 'student',
    inputSchema: { type: 'object', required: ['attempt_id'], additionalProperties: false, properties: { attempt_id: uuid() } },
    async handler(user, args) { return student.attemptResult(String((args as any).attempt_id), user); },
  },
  {
    name: 'list_my_assignments',
    description: 'Student only: assignments in one of your classrooms.',
    audience: 'student',
    inputSchema: { type: 'object', required: ['classroom_id'], additionalProperties: false, properties: { classroom_id: uuid() } },
    async handler(user, args) { return { assignments: await assignments.listAssignments(String((args as any).classroom_id), user) }; },
  },
  {
    name: 'get_my_submission',
    description: 'Student only: your draft or submitted work for one assignment.',
    audience: 'student',
    inputSchema: { type: 'object', required: ['assignment_id'], additionalProperties: false, properties: { assignment_id: uuid() } },
    async handler(user, args) { return assignments.mySubmission(String((args as any).assignment_id), user); },
  },
];

export const toolIndex = new Map(TOOLS.map((t) => [t.name, t]));

export async function roleOfUser(user: AuthedUser): Promise<'teacher' | 'student' | null> {
  const { data } = await db().from('users').select('role').eq('uid', user.id).maybeSingle();
  const r = (data as any)?.role;
  return r === 'teacher' || r === 'student' ? r : null;
}

export async function listTools(user: AuthedUser) {
  const role = await roleOfUser(user);
  return TOOLS.filter((t) => t.audience === 'any' || t.audience === role).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

export async function callTool(user: AuthedUser, name: string, args: Json | undefined) {
  const tool = toolIndex.get(name);
  if (!tool) throw { status: 404, message: `Unknown tool: ${name}` };
  if (tool.audience !== 'any') {
    const role = await roleOfUser(user);
    if (role !== tool.audience) throw forbidden(`This tool is for ${tool.audience}s. Your account is a ${role ?? 'account without a role'}.`);
  }
  return tool.handler(user, (args ?? {}) as Json, roleOfUser);
}

export { TOOLS as __toolsForTests };
