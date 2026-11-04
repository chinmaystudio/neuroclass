import { db, dbFail, notFound, type AuthedUser } from '../core/http';
import { resolveClassroomAccess, type ClassroomAccess } from '../core/access';
import { normalizeLegacyQuestion, toStoredQuestion, type QuestionRow, readConfig, readSecurity, type TestStatus } from './domain';

export type TestRow = {
  id: string;
  classroom_id: string;
  title: string;
  subject: string | null;
  description: string | null;
  instructions: string | null;
  status: TestStatus;
  duration_mins: number | null;
  duration_minutes?: number | null;
  total_marks: number | null;
  passing_marks: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  config: unknown;
  security: unknown;
  results_released: boolean;
  exam_mode: 'standard' | 'coding';
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
  proctoring_enabled: boolean | null;
  questions?: unknown;
};

export const TEST_COLUMNS = 'id,classroom_id,title,subject,description,instructions,status,duration_mins,total_marks,passing_marks,scheduled_start,scheduled_end,config,security,results_released,exam_mode,created_by,created_at,updated_at,published_at,proctoring_enabled';

export const durationOf = (test: TestRow) => Number(test.duration_mins ?? test.duration_minutes ?? 60) || 60;

export async function loadTest(testId: string): Promise<TestRow> {
  const { data, error } = await db().from('tests').select(TEST_COLUMNS).eq('id', testId).maybeSingle();
  if (error) dbFail('load test', error);
  if (!data) throw notFound('Test not found.');
  return data as unknown as TestRow;
}

/** Loads a test and the caller's role in its classroom; never reveals tests in other classrooms. */
export async function loadTestWithAccess(testId: string, user: AuthedUser): Promise<{ test: TestRow; access: ClassroomAccess }> {
  const test = await loadTest(testId);
  if (!test.classroom_id) throw notFound('Test not found.');
  const access = await resolveClassroomAccess(test.classroom_id, user).catch(() => { throw notFound('Test not found.'); });
  if (access.role === 'student' && test.status === 'draft') throw notFound('Test not found.');
  return { test, access };
}

/**
 * Loads questions. Legacy tests stored their questions (with answers) in the
 * tests.questions JSONB column; they are normalised into test_questions the
 * first time they are needed (idempotent).
 */
export async function loadQuestions(testId: string): Promise<QuestionRow[]> {
  const { data, error } = await db().from('test_questions').select('id,test_id,position,type,prompt,options,answer_key,marks,negative_marks,explanation,coding').eq('test_id', testId).order('position');
  if (error) dbFail('load questions', error);
  if (data && data.length) return data as unknown as QuestionRow[];

  const legacy = await db().from('tests').select('questions').eq('id', testId).maybeSingle();
  const raw = Array.isArray(legacy.data?.questions) ? legacy.data!.questions as unknown[] : [];
  if (!raw.length) return [];
  const rows = raw.map(normalizeLegacyQuestion).filter(Boolean).map((q, i) => ({ ...toStoredQuestion(q!, i), test_id: testId }));
  if (!rows.length) return [];
  const inserted = await db().from('test_questions').insert(rows).select('id,test_id,position,type,prompt,options,answer_key,marks,negative_marks,explanation,coding').order('position');
  if (inserted.error) {
    // A concurrent request may have imported them already.
    const again = await db().from('test_questions').select('id,test_id,position,type,prompt,options,answer_key,marks,negative_marks,explanation,coding').eq('test_id', testId).order('position');
    if (again.error) dbFail('load questions after legacy import', again.error);
    return (again.data ?? []) as unknown as QuestionRow[];
  }
  return (inserted.data ?? []) as unknown as QuestionRow[];
}

export async function loadTestCases(questionIds: string[], includeHidden: boolean) {
  if (!questionIds.length) return [] as Array<{ id: string; question_id: string; input: string; expected_output: string; is_hidden: boolean; weight: number; position: number }>;
  let query = db().from('coding_test_cases').select('id,question_id,input,expected_output,is_hidden,weight,position').in('question_id', questionIds).order('position');
  if (!includeHidden) query = query.eq('is_hidden', false);
  const { data, error } = await query;
  if (error) dbFail('load test cases', error);
  return (data ?? []) as Array<{ id: string; question_id: string; input: string; expected_output: string; is_hidden: boolean; weight: number; position: number }>;
}

export async function countAttempts(testId: string, statuses?: string[]) {
  let query = db().from('attempts').select('id', { count: 'exact', head: true }).eq('test_id', testId);
  if (statuses) query = query.in('status', statuses);
  const { count, error } = await query;
  if (error) dbFail('count attempts', error);
  return count ?? 0;
}

export function testSummary(test: TestRow, questionCount?: number) {
  return {
    id: test.id,
    classroomId: test.classroom_id,
    title: test.title,
    subject: test.subject,
    description: test.description,
    instructions: test.instructions,
    status: test.status,
    durationMinutes: durationOf(test),
    totalMarks: Number(test.total_marks ?? 0),
    passingMarks: test.passing_marks === null ? null : Number(test.passing_marks),
    scheduledStart: test.scheduled_start,
    scheduledEnd: test.scheduled_end,
    examMode: test.exam_mode ?? 'standard',
    resultsReleased: Boolean(test.results_released),
    config: readConfig(test.config),
    security: readSecurity(test.security),
    createdAt: test.created_at,
    updatedAt: test.updated_at,
    publishedAt: test.published_at,
    questionCount,
  };
}
