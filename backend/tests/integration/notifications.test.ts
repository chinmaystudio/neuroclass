/**
 * Email notifications (outbox) and first-time role choice for Google sign-ups,
 * against the production-shaped database. Run with TEST_DATABASE_URL set.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSupabase } from './pgSupabase';
import { __setDbForTests } from '../../modules/core/http';
import { __setMailProviderForTests, type MailMessage, type MailProvider } from '../../modules/notifications/mailer';
import { flushOutbox } from '../../modules/notifications/notify';
import { dispatch } from '../../modules/router';

const URL_ = process.env.TEST_DATABASE_URL;
const suite = URL_ ? describe : describe.skip;

const CLASS = 'dddddddd-0000-4000-8000-0000000000d1';
const TEACHER = { id: '7d000000-0000-4000-8000-0000000000d1', email: 'notify.teacher@school.test', token: 'notify-teacher-token-00000000' };
const STUDENTS = [1, 2, 3].map((n) => ({ id: `5d000000-0000-4000-8000-00000000000${n}`, email: `notify.student${n}@school.test`, token: `notify-student-token-${n}-000000` }));

let pg: PgSupabase;
let outbox: MailMessage[] = [];
let failNext = false;
const fakeMail: MailProvider = {
  name: 'fake',
  async sendBatch(messages) {
    if (failNext) { failNext = false; return messages.map((m) => ({ to: m.to, ok: false, error: 'provider down' })); }
    outbox.push(...messages);
    return messages.map((m) => ({ to: m.to, ok: true }));
  },
};

async function call(method: string, path: string, token: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await dispatch(new Request(`http://local/api/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), path.split('/'));
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function asUser<T>(user: { id: string; email: string }, sql: string, params: unknown[] = []): Promise<T[]> {
  const c = await pg.pool.connect();
  try {
    await c.query('begin');
    await c.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true), set_config('role', 'authenticated', true)", [user.id, JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' })]);
    const { rows } = await c.query(sql, params);
    await c.query('commit');
    return rows as T[];
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

suite('notifications and role choice (integration)', () => {
  beforeAll(async () => {
    pg = new PgSupabase(URL_!);
    __setDbForTests(pg as any);
    __setMailProviderForTests(fakeMail);
    pg.users.set(TEACHER.token, { id: TEACHER.id, email: TEACHER.email });
    STUDENTS.forEach((s) => pg.users.set(s.token, { id: s.id, email: s.email }));
    await pg.pool.query('delete from public.classrooms where id = $1', [CLASS]);
    await pg.pool.query(`insert into public.classrooms (id, name, code, user_id) values ($1, 'Biology <B>', 'BIONTF', $2)`, [CLASS, TEACHER.id]);
    await pg.pool.query(`insert into public.users (uid, email, role, role_chosen_at, email_notifications) values
      ($1, $2, 'student', now(), true), ($3, $4, 'student', now(), false), ($5, $6, 'student', now(), true)
      on conflict (uid) do update set email_notifications = excluded.email_notifications`,
      [STUDENTS[0].id, STUDENTS[0].email, STUDENTS[1].id, STUDENTS[1].email, STUDENTS[2].id, STUDENTS[2].email]);
    await pg.pool.query(`insert into public.students (classroom_id, user_id, name, email) values
      ($1, $2, 'One', $3), ($1, $4, 'Two (opted out)', $5), ($1, $6, 'Three', $7), ($1, null, 'No email', null)`,
      [CLASS, STUDENTS[0].id, STUDENTS[0].email.toUpperCase(), STUDENTS[1].id, STUDENTS[1].email, STUDENTS[2].id, STUDENTS[2].email]);
  });

  afterAll(async () => {
    __setMailProviderForTests(undefined);
    __setDbForTests(null);
    await pg.pool.end();
  });

  let testId = '';
  it('publishing a test emails each enrolled student once, skipping opt-outs and missing emails', async () => {
    outbox = [];
    const created = await call('POST', `classrooms/${CLASS}/tests`, TEACHER.token, { title: 'Cells <script>alert(1)</script>', durationMinutes: 30, security: { requireFullscreen: false, requireCamera: true } });
    testId = created.body.id;
    await call('PUT', `tests/${testId}/questions`, TEACHER.token, [{ type: 'mcq', prompt: 'q', marks: 1, options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: false }] }]);
    const pub = await call('POST', `tests/${testId}/publish`, TEACHER.token, {});
    expect(pub.status).toBe(200);
    expect(pub.body.notifications).toMatchObject({ queued: 2, sent: 2, failed: 0 });
    expect(outbox.map((m) => m.to).sort()).toEqual([STUDENTS[0].email, STUDENTS[2].email]);
    const m = outbox[0];
    expect(m.subject).toBe('New test in Biology <B>: Cells <script>alert(1)</script>');
    expect(m.html).not.toContain('<script>alert(1)</script>');
    expect(m.html).toContain('Cells &lt;script&gt;');
    expect(m.html).toContain('Camera checks are on');
    expect(m.text).toContain('/student/tests');
  });

  it('re-publishing the same test does not email students again', async () => {
    outbox = [];
    expect((await call('POST', `tests/${testId}/unpublish`, TEACHER.token)).status).toBe(200);
    expect((await call('POST', `tests/${testId}/publish`, TEACHER.token, {})).status).toBe(200);
    expect(outbox).toHaveLength(0);
  });

  it('a failed send stays queued and is delivered by the retry worker', async () => {
    outbox = [];
    failNext = true;
    const rel = await call('POST', `tests/${testId}/release-results`, TEACHER.token, { released: true });
    expect(rel.status).toBe(200); // the teacher's action never fails because of email
    expect(rel.body.notifications).toMatchObject({ queued: 2, sent: 0, failed: 2 });
    const { rows } = await pg.pool.query(`select status, attempts, last_error from public.notification_outbox where event_key = $1`, [`test.results_released:${testId}`]);
    expect(rows.every((r) => r.status === 'pending' && r.attempts === 1 && r.last_error === 'provider down')).toBe(true);
    const retry = await flushOutbox();
    expect(retry).toMatchObject({ sent: 2, failed: 0 });
    expect(outbox.map((m) => m.subject)).toEqual(['Results released: Cells <script>alert(1)</script>', 'Results released: Cells <script>alert(1)</script>']);
  });

  it('publishing an assignment emails students with the due date', async () => {
    outbox = [];
    const created = await call('POST', `classrooms/${CLASS}/assignments`, TEACHER.token, { title: 'Lab report', assignmentType: 'file', totalMarks: 20, dueAt: '2030-01-15T10:30:00.000Z' });
    expect(created.status).toBe(200);
    const pub = await call('POST', `assignments/${created.body.id}/publish`, TEACHER.token);
    expect(pub.status).toBe(200);
    expect(outbox).toHaveLength(2);
    expect(outbox[0].subject).toBe('New assignment in Biology <B>: Lab report');
    expect(outbox[0].text).toMatch(/Due: .*2030/);
  });

  it('publishing still succeeds when email is not configured', async () => {
    __setMailProviderForTests(null);
    const created = await call('POST', `classrooms/${CLASS}/tests`, TEACHER.token, { title: 'No mail', durationMinutes: 10, security: { requireFullscreen: false } });
    await call('PUT', `tests/${created.body.id}/questions`, TEACHER.token, [{ type: 'mcq', prompt: 'q', marks: 1, options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: false }] }]);
    const pub = await call('POST', `tests/${created.body.id}/publish`, TEACHER.token, {});
    expect(pub.status).toBe(200);
    expect(pub.body.notifications).toMatchObject({ skipped: true });
    __setMailProviderForTests(fakeMail);
  });

  it('students can turn emails off for themselves only', async () => {
    const me = STUDENTS[0];
    await asUser(me, 'update public.users set email_notifications = false where uid = $1', [me.id]);
    const { rows } = await pg.pool.query('select email_notifications from public.users where uid = $1', [me.id]);
    expect(rows[0].email_notifications).toBe(false);
    await expect(asUser(me, "update public.users set role = 'teacher' where uid = $1", [me.id])).rejects.toThrow(/permission denied/);
    await expect(asUser(me, 'select * from public.notification_outbox')).rejects.toThrow(/permission denied/);
  });

  describe('first-time role choice (Google sign-up)', () => {
    const G = { id: '9a000000-0000-4000-8000-0000000000a9', email: 'google.user@gmail.test' };

    it('a Google sign-up gets a profile with no confirmed role', async () => {
      await pg.pool.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [G.id, G.email, JSON.stringify({ full_name: 'Gita Rao', avatar_url: 'https://example.test/a.png' })]);
      const { rows } = await pg.pool.query('select role, role_chosen_at, displayname, photourl from public.users where uid = $1', [G.id]);
      expect(rows[0]).toMatchObject({ role: 'student', role_chosen_at: null, displayname: 'Gita Rao', photourl: 'https://example.test/a.png' });
    });

    it('the person chooses a role once; later calls cannot change it', async () => {
      expect((await asUser<{ r: string }>(G, 'select public.nc_choose_role($1) as r', ['teacher']))[0].r).toBe('teacher');
      expect((await asUser<{ r: string }>(G, 'select public.nc_choose_role($1) as r', ['student']))[0].r).toBe('teacher');
      const { rows } = await pg.pool.query('select role, role_chosen_at from public.users where uid = $1', [G.id]);
      expect(rows[0].role).toBe('teacher');
      expect(rows[0].role_chosen_at).not.toBeNull();
    });

    it('email sign-ups keep the role they signed up with and cannot switch', async () => {
      const E = { id: '9b000000-0000-4000-8000-0000000000b9', email: 'email.user@school.test' };
      await pg.pool.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [E.id, E.email, JSON.stringify({ full_name: 'Eli', role: 'student' })]);
      expect((await asUser<{ r: string }>(E, 'select public.nc_choose_role($1) as r', ['teacher']))[0].r).toBe('student');
    });

    it('rejects invalid roles and anonymous callers', async () => {
      await expect(asUser(G, 'select public.nc_choose_role($1)', ['admin'])).rejects.toThrow(/Choose teacher or student/);
      await expect(pg.pool.query("select public.nc_choose_role('teacher')")).rejects.toThrow(/Sign in first/);
    });
  });
});
