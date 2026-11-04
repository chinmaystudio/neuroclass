import { authenticate, errorResponse, json, notFound, readJson, requireUuidParam, type AuthedUser } from './core/http';
import { getCorsHeaders } from '../lib/cors';
import * as teacher from './assessments/teacher';
import * as student from './assessments/student';
import * as proctoring from './proctoring/service';
import * as coding from './coding/service';
import * as assignments from './assignments/service';
import { z } from 'zod';

type Ctx = { request: Request; user: AuthedUser; params: Record<string, string>; url: URL };
type Handler = (ctx: Ctx) => Promise<unknown>;
type Route = { method: string; pattern: string; handler: Handler; regex: RegExp; keys: string[] };

const anyJson = z.unknown();
const body = (ctx: Ctx, max?: number) => readJson(ctx.request, anyJson, max);
const id = (ctx: Ctx, key: string) => requireUuidParam(ctx.params[key], key);

const routes: Route[] = [];
function route(method: string, pattern: string, handler: Handler) {
  const keys: string[] = [];
  const regex = new RegExp(`^${pattern.split('/').map((part) => (part.startsWith(':') ? (keys.push(part.slice(1)), '([^/]+)') : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`);
  routes.push({ method, pattern, handler, regex, keys });
}

/* ------------------------------ Tests (teacher + student) ------------------------------ */
route('GET', 'classrooms/:classroomId/tests', async (c) => {
  const classroomId = id(c, 'classroomId');
  const { resolveClassroomAccess } = await import('./core/access');
  const access = await resolveClassroomAccess(classroomId, c.user);
  return access.role === 'teacher' ? { role: 'teacher', tests: await teacher.listTeacherTests(classroomId, c.user) } : { role: 'student', tests: await student.listStudentTests(classroomId, c.user) };
});
route('POST', 'classrooms/:classroomId/tests', async (c) => teacher.createTest(id(c, 'classroomId'), c.user, await body(c)));
route('GET', 'me/tests', async (c) => ({ tests: await student.listAllStudentTests(c.user) }));
route('GET', 'tests/:testId', async (c) => teacher.getTeacherTest(id(c, 'testId'), c.user));
route('PATCH', 'tests/:testId', async (c) => teacher.updateTest(id(c, 'testId'), c.user, await body(c)));
route('DELETE', 'tests/:testId', async (c) => teacher.deleteTest(id(c, 'testId'), c.user));
route('PUT', 'tests/:testId/questions', async (c) => teacher.replaceQuestions(id(c, 'testId'), c.user, await body(c, 2_000_000)));
route('POST', 'tests/:testId/publish', async (c) => teacher.publishTest(id(c, 'testId'), c.user, await body(c)));
route('POST', 'tests/:testId/unpublish', async (c) => teacher.setTestStatus(id(c, 'testId'), c.user, 'unpublish'));
route('POST', 'tests/:testId/close', async (c) => teacher.setTestStatus(id(c, 'testId'), c.user, 'close'));
route('POST', 'tests/:testId/reopen', async (c) => teacher.setTestStatus(id(c, 'testId'), c.user, 'reopen'));
route('POST', 'tests/:testId/archive', async (c) => teacher.setTestStatus(id(c, 'testId'), c.user, 'archive'));
route('POST', 'tests/:testId/duplicate', async (c) => teacher.duplicateTest(id(c, 'testId'), c.user, await body(c)));
route('GET', 'tests/:testId/results', async (c) => teacher.testResults(id(c, 'testId'), c.user));
route('GET', 'tests/:testId/monitor', async (c) => teacher.liveMonitor(id(c, 'testId'), c.user));
route('POST', 'tests/:testId/release-results', async (c) => teacher.releaseResults(id(c, 'testId'), c.user, await body(c)));
route('POST', 'tests/:testId/attempts', async (c) => student.startAttempt(id(c, 'testId'), c.user));

/* ------------------------------ Attempts ------------------------------ */
route('GET', 'attempts/:attemptId', async (c) => student.getAttemptState(id(c, 'attemptId'), c.user));
route('POST', 'attempts/:attemptId/consent', async (c) => student.recordConsent(id(c, 'attemptId'), c.user));
route('POST', 'attempts/:attemptId/identity', async (c) => proctoring.verifyIdentity(id(c, 'attemptId'), c.user, c.request));
route('POST', 'attempts/:attemptId/begin', async (c) => student.beginAttempt(id(c, 'attemptId'), c.user));
route('PUT', 'attempts/:attemptId/answers/:questionId', async (c) => student.saveAnswer(id(c, 'attemptId'), id(c, 'questionId'), c.user, await body(c, 400_000)));
route('POST', 'attempts/:attemptId/answers', async (c) => student.saveAnswersBatch(id(c, 'attemptId'), c.user, await body(c, 2_000_000)));
route('POST', 'attempts/:attemptId/submit', async (c) => student.submitAttempt(id(c, 'attemptId'), c.user));
route('POST', 'attempts/:attemptId/heartbeat', async (c) => proctoring.heartbeat(id(c, 'attemptId'), c.user, await body(c)));
route('POST', 'attempts/:attemptId/events', async (c) => proctoring.recordEvents(id(c, 'attemptId'), c.user, await body(c, 64_000)));
route('POST', 'attempts/:attemptId/frame', async (c) => proctoring.frameCheck(id(c, 'attemptId'), c.user, c.request));
route('POST', 'attempts/:attemptId/features', async (c) => proctoring.analyzeFeatures(id(c, 'attemptId'), c.user, await body(c, 16_000)));
route('GET', 'attempts/:attemptId/result', async (c) => student.attemptResult(id(c, 'attemptId'), c.user));
route('POST', 'attempts/:attemptId/appeal', async (c) => student.submitAppeal(id(c, 'attemptId'), c.user, await body(c)));
route('GET', 'attempts/:attemptId/review', async (c) => teacher.attemptReview(id(c, 'attemptId'), c.user));
route('POST', 'attempts/:attemptId/grade', async (c) => teacher.gradeAttempt(id(c, 'attemptId'), c.user, await body(c, 500_000)));
route('POST', 'attempts/:attemptId/reevaluate-coding', async (c) => teacher.reevaluateCoding(id(c, 'attemptId'), c.user));
route('POST', 'attempts/:attemptId/identity-override', async (c) => teacher.overrideIdentity(id(c, 'attemptId'), c.user, await body(c)));
route('PATCH', 'proctoring-events/:eventId', async (c) => teacher.reviewProctoringEvent(id(c, 'eventId'), c.user, await body(c)));
route('PATCH', 'appeals/:appealId', async (c) => teacher.resolveAppeal(id(c, 'appealId'), c.user, await body(c)));
route('GET', 'proctoring/status', async () => proctoring.serviceStatus());

/* ------------------------------ Code execution ------------------------------ */
route('GET', 'code/languages', async () => ({ languages: coding.languages() }));
route('POST', 'code/run', async (c) => coding.runCode(c.user, await body(c, 300_000)));
route('PUT', 'code/workspace', async (c) => coding.saveAssignmentWorkspace(c.user, await body(c, 300_000)));
route('GET', 'code/workspace/:assignmentId', async (c) => ({ workspace: await coding.loadAssignmentWorkspace(c.user, id(c, 'assignmentId')) }));

/* ------------------------------ Assignments ------------------------------ */
route('GET', 'classrooms/:classroomId/assignments', async (c) => ({ assignments: await assignments.listAssignments(id(c, 'classroomId'), c.user) }));
route('POST', 'classrooms/:classroomId/assignments', async (c) => assignments.createAssignment(id(c, 'classroomId'), c.user, await body(c, 600_000)));
route('GET', 'assignments/:assignmentId', async (c) => assignments.getAssignment(id(c, 'assignmentId'), c.user));
route('PATCH', 'assignments/:assignmentId', async (c) => assignments.updateAssignment(id(c, 'assignmentId'), c.user, await body(c, 600_000)));
route('DELETE', 'assignments/:assignmentId', async (c) => assignments.deleteAssignment(id(c, 'assignmentId'), c.user));
for (const action of ['publish', 'unpublish', 'close', 'reopen', 'archive'] as const) {
  route('POST', `assignments/:assignmentId/${action}`, async (c) => assignments.setAssignmentStatus(id(c, 'assignmentId'), c.user, action));
}
route('POST', 'assignments/:assignmentId/attachments', async (c) => assignments.uploadAttachment(id(c, 'assignmentId'), c.user, c.request));
route('DELETE', 'assignments/:assignmentId/attachments/:attachmentId', async (c) => assignments.deleteAttachment(id(c, 'assignmentId'), id(c, 'attachmentId'), c.user));
route('GET', 'assignments/:assignmentId/attachments/:attachmentId/download', async (c) => assignments.downloadAttachment(id(c, 'assignmentId'), id(c, 'attachmentId'), c.user));
route('GET', 'assignments/:assignmentId/submissions', async (c) => assignments.listSubmissions(id(c, 'assignmentId'), c.user));
route('GET', 'assignments/:assignmentId/my-submission', async (c) => assignments.mySubmission(id(c, 'assignmentId'), c.user));
route('PUT', 'assignments/:assignmentId/my-submission', async (c) => assignments.saveDraft(id(c, 'assignmentId'), c.user, await body(c, 400_000)));
route('POST', 'assignments/:assignmentId/my-submission/files', async (c) => assignments.uploadSubmissionFile(id(c, 'assignmentId'), c.user, c.request));
route('DELETE', 'assignments/:assignmentId/my-submission/files/:fileId', async (c) => assignments.deleteSubmissionFile(id(c, 'assignmentId'), id(c, 'fileId'), c.user));
route('GET', 'assignments/:assignmentId/my-submission/files/:fileId/download', async (c) => assignments.downloadMyFile(id(c, 'assignmentId'), id(c, 'fileId'), c.user));
route('POST', 'assignments/:assignmentId/my-submission/submit', async (c) => assignments.submitMine(id(c, 'assignmentId'), c.user));
route('POST', 'assignments/:assignmentId/my-submission/reopen', async (c) => assignments.reopenMySubmission(id(c, 'assignmentId'), c.user));
route('GET', 'submissions/:submissionId', async (c) => assignments.getSubmission(id(c, 'submissionId'), c.user));
route('POST', 'submissions/:submissionId/grade', async (c) => assignments.gradeSubmission(id(c, 'submissionId'), c.user, await body(c)));
route('POST', 'submissions/:submissionId/evaluate-code', async (c) => assignments.evaluateSubmissionCode(id(c, 'submissionId'), c.user));
route('GET', 'submissions/:submissionId/files/:fileId/download', async (c) => assignments.downloadSubmissionFile(id(c, 'submissionId'), id(c, 'fileId'), c.user));

export const ROUTES = routes.map((r) => `${r.method} /api/v1/${r.pattern}`);

export async function dispatch(request: Request, segments: string[]): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...getCorsHeaders(request.headers.get('origin')), 'Access-Control-Max-Age': '600' } });
  try {
    const path = segments.map((s) => decodeURIComponent(s)).join('/');
    let methodMismatch = false;
    for (const r of routes) {
      const match = r.regex.exec(path);
      if (!match) continue;
      if (r.method !== request.method) { methodMismatch = true; continue; }
      const params = Object.fromEntries(r.keys.map((k, i) => [k, match[i + 1]]));
      // Every route requires a valid Supabase session.
      const user = await authenticate(request);
      const result = await r.handler({ request, user, params, url: new URL(request.url) });
      return json(request, result ?? {});
    }
    if (methodMismatch) return json(request, { error: 'Method not allowed.', code: 'method_not_allowed' }, 405);
    throw notFound('Unknown API route.');
  } catch (error) {
    return errorResponse(request, error);
  }
}
