/**
 * Row Level Security checks against the production-shaped database (see
 * prepare-db.sh + seed-prod-like.sql). Each case runs inside a transaction as
 * the real `anon` / `authenticated` role with Supabase-style JWT claims, then
 * rolls back. Skipped when TEST_DATABASE_URL is unset.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const URL_ = process.env.TEST_DATABASE_URL;
const suite = URL_ ? describe : describe.skip;

const TEACHER = { id: 'a0000000-0000-4000-8000-000000000001', email: 'legacy.teacher@example.test' };
const STUDENT = { id: 'a0000000-0000-4000-8000-000000000002', email: 'legacy.student@example.test' };
const NEWCOMER = { id: 'a0000000-0000-4000-8000-000000000003', email: 'no.meta@example.test' };
const OTHER = { id: 'a0000000-0000-4000-8000-000000000004', email: 'other.student@example.test' };
const PHYSICS = 'c0000000-0000-4000-8000-000000000001';
const CHEMISTRY = 'c0000000-0000-4000-8000-000000000002';
const STUDENT_ROW = 'd0000000-0000-4000-8000-000000000002';
const ATTENDANCE_ROW = 'e1000000-0000-4000-8000-000000000001';

let pool: Pool;

type Who = { id: string; email: string } | 'anon';

async function as<T>(who: Who, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    if (who === 'anon') {
      await c.query("SET LOCAL ROLE anon");
    } else {
      await c.query("SET LOCAL ROLE authenticated");
      await c.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
        [who.id, JSON.stringify({ sub: who.id, email: who.email, role: 'authenticated' })]);
    }
    return await fn(c);
  } finally {
    await c.query('ROLLBACK').catch(() => undefined);
    c.release();
  }
}

/** Runs a statement and returns the SQLSTATE it failed with (or null on success). */
async function failsWith(who: Who, sql: string, params: unknown[] = []): Promise<string | null> {
  return as(who, async (c) => {
    try { await c.query(sql, params); return null; } catch (e: any) { return e.code ?? 'error'; }
  });
}

const rows = (who: Who, sql: string, params: unknown[] = []) => as(who, async (c) => (await c.query(sql, params)).rows);

suite('production RLS hardening', () => {
  beforeAll(() => { pool = new Pool({ connectionString: URL_, max: 4 }); });
  afterAll(async () => { await pool.end(); });

  describe('anonymous key', () => {
    it.each(['users', 'students', 'classrooms', 'tests', 'evaluations', 'tc_tests', 'tc_questions', 'tc_question_options', 'tc_users', 'face_embeddings', 'attendance_verification_attempts'])(
      'cannot read %s', async (table) => {
        expect(await failsWith('anon', `SELECT 1 FROM public.${table} LIMIT 1`)).toBe('42501');
      });
    it('cannot write students or users', async () => {
      expect(await failsWith('anon', "INSERT INTO public.students (classroom_id, name) VALUES ($1, 'x')", [PHYSICS])).toBe('42501');
      expect(await failsWith('anon', "INSERT INTO public.users (uid, email) VALUES ('x', 'x@x')")).toBe('42501');
    });
    it('cannot join a classroom', async () => {
      expect(await failsWith('anon', "SELECT * FROM public.nc_join_classroom('LEG001', 'Mallory')")).toBe('42501');
    });
    it('every public table has RLS enabled', async () => {
      const r = await pool.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity");
      expect(r.rows).toEqual([]);
    });
  });

  describe('profiles', () => {
    it('backfilled every account with a role', async () => {
      const r = await pool.query('SELECT uid, role FROM public.users ORDER BY uid');
      const byId = new Map(r.rows.map((x: any) => [x.uid, x.role]));
      expect(byId.get(TEACHER.id)).toBe('teacher');
      expect(byId.get(STUDENT.id)).toBe('student');
      expect(byId.get(NEWCOMER.id)).toBe('student');
    });
    it('a user reads only their own profile', async () => {
      const r = await rows(STUDENT, 'SELECT uid FROM public.users');
      expect(r.map((x: any) => x.uid)).toEqual([STUDENT.id]);
    });
    it('a user can edit name/phone but not role or email', async () => {
      expect(await failsWith(STUDENT, "UPDATE public.users SET displayname = 'New Name', mobile_number = '+91' WHERE uid = $1", [STUDENT.id])).toBeNull();
      expect(await failsWith(STUDENT, "UPDATE public.users SET role = 'teacher' WHERE uid = $1", [STUDENT.id])).toBe('42501');
      expect(await failsWith(STUDENT, "UPDATE public.users SET email = 'x@y' WHERE uid = $1", [STUDENT.id])).toBe('42501');
    });
    it('the sign-up trigger creates the profile from metadata', async () => {
      await as(TEACHER, async () => undefined); // ensure pool warm
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('a0000000-0000-4000-8000-0000000000ff', 'fresh@example.test', '{\"role\":\"teacher\",\"full_name\":\"Fresh\",\"phone\":\"+911\"}')");
        const r = await c.query("SELECT role, displayname, mobile_number FROM public.users WHERE uid = 'a0000000-0000-4000-8000-0000000000ff'");
        expect(r.rows[0]).toEqual({ role: 'teacher', displayname: 'Fresh', mobile_number: '+911' });
      } finally { await c.query('ROLLBACK'); c.release(); }
    });
  });

  describe('classrooms and roster', () => {
    it('members see only their classrooms; outsiders see none', async () => {
      expect((await rows(STUDENT, 'SELECT id FROM public.classrooms')).map((x: any) => x.id)).toEqual([PHYSICS]);
      expect(await rows(NEWCOMER, 'SELECT id FROM public.classrooms')).toEqual([]);
      expect((await rows(TEACHER, 'SELECT id FROM public.classrooms ORDER BY created_at')).map((x: any) => x.id)).toEqual([PHYSICS, CHEMISTRY]);
    });
    it('a student cannot create a classroom for someone else', async () => {
      expect(await failsWith(STUDENT, "INSERT INTO public.classrooms (name, code, user_id) VALUES ('x', 'ZZZ999', $1)", [TEACHER.id])).toBe('42501');
      expect(await failsWith(STUDENT, "INSERT INTO public.classrooms (name, code, user_id) VALUES ('Mine', 'ZZZ998', $1)", [STUDENT.id])).toBeNull();
    });
    it('students see only their own roster rows, never other classmates or classrooms', async () => {
      expect((await rows(STUDENT, 'SELECT id FROM public.students')).map((x: any) => x.id)).toEqual([STUDENT_ROW]);
      expect(await rows(OTHER, 'SELECT id FROM public.students WHERE classroom_id = $1', [PHYSICS])).toEqual([]);
    });
    it('teachers see their roster (including counts) but never legacy face columns', async () => {
      expect((await rows(TEACHER, 'SELECT count(*)::int AS n FROM public.students'))[0].n).toBe(2);
      expect(await failsWith(TEACHER, 'SELECT face_descriptor FROM public.students')).toBe('42501');
      expect(await failsWith(STUDENT, 'SELECT face_samples FROM public.students')).toBe('42501');
      expect(await failsWith(STUDENT, 'SELECT * FROM public.students')).toBe('42501');
    });
    it('students cannot insert or modify roster rows directly', async () => {
      expect(await failsWith(NEWCOMER, "INSERT INTO public.students (classroom_id, user_id, name) VALUES ($1, $2, 'x')", [PHYSICS, NEWCOMER.id])).toBe('42501');
      expect(await failsWith(STUDENT, "UPDATE public.students SET face_registration_status = 'REGISTERED' WHERE user_id = $1", [STUDENT.id])).toBe('42501');
    });
    it('teachers of another classroom cannot edit this roster', async () => {
      const r = await as(OTHER, async (c) => (await c.query("UPDATE public.students SET name = 'hacked' WHERE id = $1", [STUDENT_ROW])).rowCount);
      expect(r).toBe(0);
    });
  });

  describe('nc_join_classroom', () => {
    it('joins by code, links the account, updates the count', async () => {
      await as(NEWCOMER, async (c) => {
        const r = await c.query("SELECT * FROM public.nc_join_classroom('leg002 ', 'New Comer', 'R-1', '+91')");
        expect(r.rows[0].classroom_id).toBe(CHEMISTRY);
        expect(r.rows[0].classroom_name).toBe('Legacy Chemistry');
        const mine = await c.query('SELECT classroom_id, user_id, email, name, roll_number FROM public.students');
        expect(mine.rows).toEqual([{ classroom_id: CHEMISTRY, user_id: NEWCOMER.id, email: NEWCOMER.email, name: 'New Comer', roll_number: 'R-1' }]);
        expect((await c.query('SELECT id FROM public.classrooms')).rows.map((x: any) => x.id)).toEqual([CHEMISTRY]);
        expect((await c.query('SELECT students FROM public.classrooms')).rows[0].students).toBe(2);
        const again = await c.query("SELECT * FROM public.nc_join_classroom('LEG002', 'New Comer')").catch((e) => e);
        expect(again.code).toBe('23505');
      });
    });
    it('rejects unknown codes, own classrooms and invalid names', async () => {
      expect(await failsWith(NEWCOMER, "SELECT * FROM public.nc_join_classroom('NOPE00', 'Some Name')")).toBe('P0002');
      expect(await failsWith(TEACHER, "SELECT * FROM public.nc_join_classroom('LEG001', 'Teacher')")).toBe('22023');
      expect(await failsWith(NEWCOMER, "SELECT * FROM public.nc_join_classroom('LEG001', ' ')")).toBe('22023');
    });
    it('rate limits code guessing (30 attempts per hour)', async () => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        for (let i = 0; i < 30; i += 1) await c.query("SELECT public.nc_rate_limit_hit('join_classroom', $1, 3600, 30)", [NEWCOMER.id]);
        await c.query("SET LOCAL ROLE authenticated");
        await c.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [NEWCOMER.id, JSON.stringify({ sub: NEWCOMER.id, email: NEWCOMER.email })]);
        const e = await c.query("SELECT * FROM public.nc_join_classroom('LEG002', 'Some Name')").catch((err) => err);
        expect(e.code).toBe('P0001');
      } finally { await c.query('ROLLBACK'); c.release(); }
    });
    it('the rate limiter itself is not callable by clients', async () => {
      expect(await failsWith(STUDENT, "SELECT public.nc_rate_limit_hit('x', 'y', 60, 1)")).toBe('42501');
    });
  });

  describe('biometrics', () => {
    it('no client can read face embeddings', async () => {
      expect(await failsWith(TEACHER, 'SELECT 1 FROM public.face_embeddings')).toBe('42501');
      expect(await failsWith(STUDENT, 'SELECT 1 FROM public.face_embeddings')).toBe('42501');
    });
    it('face profiles: own and owned classroom only', async () => {
      expect((await rows(STUDENT, 'SELECT student_id FROM public.face_profiles')).map((x: any) => x.student_id)).toEqual([STUDENT_ROW]);
      expect((await rows(TEACHER, 'SELECT count(*)::int n FROM public.face_profiles'))[0].n).toBe(2);
      expect((await rows(OTHER, 'SELECT student_id FROM public.face_profiles WHERE classroom_id = $1', [PHYSICS]))).toEqual([]);
    });
    it('a student can delete their own Face-ID data and nobody else\'s', async () => {
      await as(STUDENT, async (c) => {
        const n = await c.query('SELECT public.nc_clear_my_face_data() AS n');
        expect(n.rows[0].n).toBe(1);
        expect((await c.query('SELECT face_registration_status FROM public.students')).rows[0].face_registration_status).toBe('NOT_REGISTERED');
        expect((await c.query('SELECT count(*)::int n FROM public.face_profiles')).rows[0].n).toBe(0);
        await c.query('RESET ROLE');
        const left = await c.query('SELECT student_id FROM public.face_embeddings');
        expect(left.rows.map((x: any) => x.student_id)).toEqual(['d0000000-0000-4000-8000-000000000004']);
      });
    });
  });

  describe('assessments', () => {
    it('students cannot read answer keys or raw questions', async () => {
      expect(await failsWith(STUDENT, 'SELECT questions FROM public.tests')).toBe('42501');
      expect(await failsWith(STUDENT, 'SELECT 1 FROM public.test_questions')).toBeNull();
      expect(await rows(STUDENT, 'SELECT answer_key FROM public.test_questions')).toEqual([]);
    });
    it('students see published tests of their classroom only; drafts stay hidden', async () => {
      const titles = (await rows(STUDENT, 'SELECT title, status FROM public.tests ORDER BY title')).map((x: any) => `${x.title}:${x.status}`);
      expect(titles).toContain('Portal proctored test:published');
      expect(titles.every((t: string) => t.endsWith(':published') || t.endsWith(':closed'))).toBe(true);
      expect(titles.some((t: string) => t.startsWith('Portal live test'))).toBe(false); // draft in another classroom
      expect(await rows(OTHER, 'SELECT title FROM public.tests WHERE classroom_id = $1', [PHYSICS])).toEqual([]);
    });
    it('clients cannot write tests or attempts directly', async () => {
      expect(await failsWith(TEACHER, "UPDATE public.tests SET title = 'x' WHERE classroom_id = $1", [PHYSICS])).toBe('42501');
      expect(await failsWith(STUDENT, "INSERT INTO public.attempts (test_id, student_id) SELECT id, $1 FROM public.tests LIMIT 1", [STUDENT.id])).toBe('42501');
      expect(await failsWith(STUDENT, "UPDATE public.attempts SET score = 100 WHERE student_id = $1", [STUDENT.id])).toBe('42501');
    });
    it('students cannot read attempt rows (scores are released through the API)', async () => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query("INSERT INTO public.attempts (test_id, student_id, classroom_id, status, score) SELECT id, $1, classroom_id, 'evaluated', 3 FROM public.tests WHERE legacy_source = 'tc:tcSched000000000000002'", [STUDENT.id]);
        await c.query("SET LOCAL ROLE authenticated");
        await c.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [STUDENT.id]);
        expect((await c.query('SELECT score FROM public.attempts')).rows).toEqual([]);
        await c.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [TEACHER.id]);
        expect((await c.query('SELECT score FROM public.attempts')).rows.map((r: any) => Number(r.score))).toContain(3);
      } finally { await c.query('ROLLBACK'); c.release(); }
    });
  });

  describe('attendance', () => {
    it('students read their own attendance but cannot mark themselves present', async () => {
      expect((await rows(STUDENT, 'SELECT id FROM public.attendance')).map((x: any) => x.id)).toEqual([ATTENDANCE_ROW]);
      expect(await rows(OTHER, 'SELECT id FROM public.attendance')).toEqual([]);
      expect(await failsWith(STUDENT, "INSERT INTO public.attendance (classroom_id, student_id_legacy, student_name, student_id) VALUES ($1, $2, 'x', $3)", [PHYSICS, STUDENT_ROW, STUDENT_ROW])).toBe('42501');
    });
    it('appeals: own attendance only, teacher can resolve', async () => {
      expect(await failsWith(STUDENT, "INSERT INTO public.attendance_appeals (attendance_id, classroom_id, student_id, reason) VALUES ($1, $2, $3, 'I was present in class')", [ATTENDANCE_ROW, PHYSICS, STUDENT.id])).toBeNull();
      expect(await failsWith(OTHER, "INSERT INTO public.attendance_appeals (attendance_id, classroom_id, student_id, reason) VALUES ($1, $2, $3, 'Not my record')", [ATTENDANCE_ROW, PHYSICS, OTHER.id])).toBe('42501');
      expect(await failsWith(STUDENT, "INSERT INTO public.attendance_appeals (attendance_id, classroom_id, student_id, reason, status) VALUES ($1, $2, $3, 'Sneaky approval', 'accepted')", [ATTENDANCE_ROW, PHYSICS, STUDENT.id])).toBe('42501');
    });
  });

  describe('evaluations', () => {
    it('are private to the teacher who saved them', async () => {
      const insert = "INSERT INTO public.evaluations (id, type, studentname, owner_user_id, criteria_scores) VALUES ($1, 'assignment', 'Asha', $2, '[]')";
      expect(await failsWith(TEACHER, insert, ['e-1', TEACHER.id])).toBeNull();
      expect(await failsWith(TEACHER, insert, ['e-2', STUDENT.id])).toBe('42501');
      await as(TEACHER, async (c) => {
        await c.query(insert, ['e-3', TEACHER.id]);
        expect((await c.query('SELECT id FROM public.evaluations')).rows).toEqual([{ id: 'e-3' }]);
      });
      expect(await rows(STUDENT, 'SELECT id FROM public.evaluations')).toEqual([]);
    });
  });

  describe('materials', () => {
    it('members read their classroom\'s shared materials only', async () => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await c.query(`INSERT INTO public.classroom_materials (classroom_id, uploader_id, name, storage_path, mime_type, visibility) VALUES
          ($1, $3, 'Shared notes', 'p/1', 'application/pdf', 'classroom'),
          ($1, $3, 'Answer sheet', 'p/2', 'application/pdf', 'teacher_private'),
          ($2, $3, 'Chemistry notes', 'p/3', 'application/pdf', 'classroom')`, [PHYSICS, CHEMISTRY, TEACHER.id]);
        await c.query("SET LOCAL ROLE authenticated");
        await c.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [STUDENT.id, JSON.stringify({ sub: STUDENT.id, email: STUDENT.email })]);
        expect((await c.query('SELECT name FROM public.classroom_materials')).rows).toEqual([{ name: 'Shared notes' }]);
      } finally { await c.query('ROLLBACK'); c.release(); }
    });
  });
});
