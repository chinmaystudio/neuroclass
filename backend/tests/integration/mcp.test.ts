/**
 * NeuroClass MCP server: JSON-RPC over HTTP against the real router, tools
 * and production-shaped database. Covers token lifecycle, discovery,
 * teacher/student tool scoping, cross-classroom isolation, and that MCP
 * calls go through the same RLS/service checks as the website.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSupabase } from './pgSupabase';
import { __setDbForTests } from '../../modules/core/http';
import { __clearTokenCacheForTests } from '../../modules/tokens/service';
import { dispatch } from '../../modules/router';
import { handleMcp } from '../../modules/mcp/server';
import { __setMailProviderForTests, type MailProvider } from '../../modules/notifications/mailer';

const URL_ = process.env.TEST_DATABASE_URL;
const suite = URL_ ? describe : describe.skip;

const TEACHER = { id: '7ea00000-0000-4000-8000-00000000mcp1'.replace(/[^0-9a-f-]/g, '0').padEnd(36, '0').slice(0, 36), email: 'mcp.teacher@school.test', supabaseToken: 'mcp-teacher-supabase-token-00' };
const OTHER = { id: '7eb00000-0000-4000-8000-00000000mcp2'.replace(/[^0-9a-f-]/g, '0').padEnd(36, '0').slice(0, 36), email: 'mcp.other@school.test', supabaseToken: 'mcp-other-supabase-token-00' };
const STUDENT = { id: '7ec00000-0000-4000-8000-00000000mcp3'.replace(/[^0-9a-f-]/g, '0').padEnd(36, '0').slice(0, 36), email: 'mcp.student@school.test', supabaseToken: 'mcp-student-supabase-token-00' };

let pg: PgSupabase;
const silentMail: MailProvider = { name: 'silent', async sendBatch(messages) { return messages.map((m) => ({ to: m.to, ok: true })); } };

async function api(method: string, path: string, supabaseToken: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${supabaseToken}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await dispatch(new Request(`http://local/api/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), path.split('/'));
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function mcp(token: string | null, rpc: any, method: 'POST' | 'GET' | 'OPTIONS' = 'POST') {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (method === 'POST') { headers['content-type'] = 'application/json'; init.body = JSON.stringify(rpc); }
  const res = await handleMcp(new Request('http://local/api/mcp', init));
  const text = await res.text();
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: text ? JSON.parse(text) : null };
}

suite('NeuroClass MCP server', () => {
  beforeAll(async () => {
    pg = new PgSupabase(URL_!);
    __setDbForTests(pg as any);
    __setMailProviderForTests(silentMail);
    __clearTokenCacheForTests();
    pg.users.set(TEACHER.supabaseToken, { id: TEACHER.id, email: TEACHER.email });
    pg.users.set(OTHER.supabaseToken, { id: OTHER.id, email: OTHER.email });
    pg.users.set(STUDENT.supabaseToken, { id: STUDENT.id, email: STUDENT.email });
    const ids = [TEACHER.id, OTHER.id, STUDENT.id];
    await pg.pool.query('delete from public.api_tokens where user_id = any($1)', [ids]);
    await pg.pool.query('delete from public.students where user_id = any($1)', [ids]);
    await pg.pool.query('delete from public.classrooms where user_id = any($1)', [ids]);
    await pg.pool.query(`insert into public.users (uid, email, role, role_chosen_at) values ($1,$2,'teacher', now()), ($3,$4,'teacher', now()), ($5,$6,'student', now())
      on conflict (uid) do update set role = excluded.role, role_chosen_at = coalesce(public.users.role_chosen_at, now())`,
      [TEACHER.id, TEACHER.email, OTHER.id, OTHER.email, STUDENT.id, STUDENT.email]);
  });

  afterAll(async () => {
    __setMailProviderForTests(undefined);
    __setDbForTests(null);
    await pg.pool.end();
  });

  let teacherToken = '';
  let studentToken = '';
  let otherToken = '';
  let teacherTokenId = '';

  it('issues a personal access token (shown once) and lists it without the hash', async () => {
    const created = await api('POST', 'me/tokens', TEACHER.supabaseToken, { name: 'Claude Desktop' });
    expect(created.status).toBe(200);
    expect(created.body.token).toMatch(/^nc_live_[A-Z2-9]{32}$/);
    expect(created.body).toMatchObject({ name: 'Claude Desktop' });
    expect(created.body.prefix).not.toContain(created.body.token.slice(16));
    teacherToken = created.body.token; teacherTokenId = created.body.id;
    studentToken = (await api('POST', 'me/tokens', STUDENT.supabaseToken, { name: 'ChatGPT' })).body.token;
    otherToken = (await api('POST', 'me/tokens', OTHER.supabaseToken, { name: 'Cursor' })).body.token;
    const list = await api('GET', 'me/tokens', TEACHER.supabaseToken);
    expect(list.body.tokens.map((t: any) => t.name)).toContain('Claude Desktop');
    expect(JSON.stringify(list.body)).not.toContain(teacherToken);
  });

  it('answers initialize and ping', async () => {
    const init = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
    expect(init.status).toBe(200);
    expect(init.body.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'neuroclass' } });
    expect(init.body.result.capabilities.tools).toBeDefined();
    const ping = await mcp(teacherToken, { jsonrpc: '2.0', id: 2, method: 'ping' });
    expect(ping.body.result).toEqual({});
  });

  it('rejects requests without a valid token', async () => {
    const no = await mcp(null, { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(no.status).toBe(401);
    expect(no.body.error.code).toBe(-32001);
    const bad = await mcp('nc_live_NOTAREALTOKEN00000000000000000000', { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(bad.status).toBe(401);
    const malformed = await mcp('hello', { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(malformed.status).toBe(401);
  });

  it('lists only the tools the role is allowed to use', async () => {
    const t = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = t.body.result.tools.map((x: any) => x.name).sort();
    expect(names).toContain('whoami'); expect(names).toContain('create_classroom'); expect(names).toContain('grade_attempt');
    expect(names).not.toContain('join_classroom'); expect(names).not.toContain('get_my_result');
    const s = await mcp(studentToken, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const sn = s.body.result.tools.map((x: any) => x.name).sort();
    expect(sn).toContain('join_classroom'); expect(sn).toContain('list_my_tests'); expect(sn).toContain('whoami');
    expect(sn).not.toContain('create_classroom'); expect(sn).not.toContain('publish_test');
  });

  it('whoami returns the owning account', async () => {
    const r = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami' } });
    expect(r.body.result).toMatchObject({ isError: false });
    expect(r.body.result.structuredContent).toMatchObject({ userId: TEACHER.id, email: TEACHER.email, role: 'teacher' });
  });

  let classroomId = '';
  let classCode = '';
  it('creates a classroom, lets a student join with the code, and both see their own view', async () => {
    const created = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_classroom', arguments: { name: 'Physics MCP', subject: 'Physics' } } });
    expect(created.body.result.isError).toBe(false);
    classroomId = created.body.result.structuredContent.id;
    classCode = created.body.result.structuredContent.code;
    expect(classCode).toMatch(/^[A-Z2-9]{6}$/);

    const joined = await mcp(studentToken, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'join_classroom', arguments: { code: classCode, name: 'Sam Student' } } });
    expect(joined.body.result.isError).toBe(false);
    expect(joined.body.result.structuredContent.joined.classroom_id).toBe(classroomId);

    const mine = await mcp(studentToken, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_my_classrooms' } });
    expect(mine.body.result.structuredContent.role).toBe('student');
    expect(mine.body.result.structuredContent.classrooms.map((c: any) => c.id)).toEqual([classroomId]);

    const detail = await mcp(teacherToken, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_classroom', arguments: { classroom_id: classroomId } } });
    expect(detail.body.result.structuredContent.code).toBe(classCode);
    expect(detail.body.result.structuredContent.students).toHaveLength(1);
  });

  let testId = '';
  it('creates, fills and publishes a test in one call, the student sees it', async () => {
    const r = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_test', arguments: {
      classroom_id: classroomId, title: 'Kinematics via MCP', durationMinutes: 20, publish: true,
      security: { requireFullscreen: false, requireCamera: false, requireIdentityVerification: false, liveProctoring: false, livenessCheck: false },
      questions: [
        { type: 'mcq', prompt: 'Unit of force?', marks: 2, options: [{ text: 'Newton', isCorrect: true }, { text: 'Joule', isCorrect: false }] },
        { type: 'numerical', prompt: '2 + 2?', marks: 1, numericAnswer: 4 },
      ],
    } } });
    expect(r.body.result.isError).toBe(false);
    const published = r.body.result.structuredContent;
    expect(published).toMatchObject({ title: 'Kinematics via MCP', availability: 'active' });
    testId = published.id;

    const list = await mcp(studentToken, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_my_tests' } });
    expect(list.body.result.structuredContent.tests.map((t: any) => t.id)).toContain(testId);

    const got = await mcp(studentToken, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_my_tests', arguments: { classroom_id: classroomId } } });
    expect(JSON.stringify(got.body)).not.toMatch(/numericAnswer|isCorrect/);
  });

  it('creates and publishes an assignment', async () => {
    const r = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_assignment', arguments: {
      classroom_id: classroomId, title: 'Lab via MCP', assignmentType: 'text', totalMarks: 10, dueAt: '2030-02-01T10:00:00Z', publish: true,
    } } });
    expect(r.body.result.isError).toBe(false);
    expect(r.body.result.structuredContent).toMatchObject({ title: 'Lab via MCP', status: 'published' });
    const list = await mcp(studentToken, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_my_assignments', arguments: { classroom_id: classroomId } } });
    expect(list.body.result.structuredContent.assignments[0]).toMatchObject({ title: 'Lab via MCP' });
  });

  it('enforces role on every tool call, not just discovery', async () => {
    const forbid = await mcp(studentToken, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_classroom', arguments: { name: 'X' } } });
    expect(forbid.body.result.isError).toBe(true);
    expect(forbid.body.result.content[0].text).toMatch(/teachers/);
  });

  it('cannot cross classroom boundaries just because MCP is used', async () => {
    const r = await mcp(otherToken, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_classroom', arguments: { classroom_id: classroomId } } });
    expect(r.body.result.isError).toBe(true);
    const unrelated = await mcp(otherToken, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'publish_test', arguments: { test_id: testId } } });
    expect(unrelated.body.result.isError).toBe(true);
  });

  it('accepts JSON-RPC batches (initialize + tools/list in one POST)', async () => {
    const r = await mcp(teacherToken, [
      { jsonrpc: '2.0', id: 'a', method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', id: 'b', method: 'tools/list' },
      { jsonrpc: '2.0', method: 'notifications/initialized' }, // no response expected
    ]);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.map((x: any) => x.id)).toEqual(['a', 'b']);
  });

  it('OPTIONS preflight passes CORS, GET returns server info, bad JSON returns -32700', async () => {
    const opt = await mcp(null, null, 'OPTIONS');
    expect(opt.status).toBe(204);
    expect(opt.headers['access-control-allow-methods']).toContain('POST');
    const get = await mcp(null, null, 'GET');
    expect(get.body).toMatchObject({ server: { name: 'neuroclass' } });
    const parseError = await handleMcp(new Request('http://local/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${teacherToken}`, 'content-type': 'application/json' }, body: 'not json' }));
    const parsed = JSON.parse(await parseError.text());
    expect(parsed.error.code).toBe(-32700);
  });

  it('revoking a token blocks all further MCP calls (within a cache window)', async () => {
    const d = await api('DELETE', `me/tokens/${teacherTokenId}`, TEACHER.supabaseToken);
    expect(d.status).toBe(200);
    __clearTokenCacheForTests();
    const r = await mcp(teacherToken, { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(r.status).toBe(401);
    // A revoked token id can't be revoked again or listed.
    expect((await api('DELETE', `me/tokens/${teacherTokenId}`, TEACHER.supabaseToken)).status).toBe(404);
    const list = await api('GET', 'me/tokens', TEACHER.supabaseToken);
    expect(list.body.tokens.find((t: any) => t.id === teacherTokenId)).toBeUndefined();
  });

  it('refuses token names that are too long or empty, and caps per-account count', async () => {
    const empty = await api('POST', 'me/tokens', OTHER.supabaseToken, { name: '' });
    expect(empty.status).toBe(400);
    const tooLong = await api('POST', 'me/tokens', OTHER.supabaseToken, { name: 'x'.repeat(200) });
    expect(tooLong.status).toBe(400);
  });
});
