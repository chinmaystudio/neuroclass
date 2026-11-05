/**
 * Classroom email notifications through an outbox:
 *  1. one row per (event, recipient) is inserted; the unique key makes this
 *     idempotent, so re-publishing never emails a student twice;
 *  2. pending rows for the event are sent right away (bounded time);
 *  3. anything that failed is retried by the notifications worker.
 * Notifications never block or fail the teacher's action.
 */
import { db } from '../core/http';
import { getMailProvider, type MailMessage } from './mailer';

export type NotificationEvent =
  | { kind: 'test.published'; testId: string; classroomId: string; title: string; opensAt: string | null; closesAt: string | null; durationMinutes: number; totalMarks: number; proctored: boolean }
  | { kind: 'test.results_released'; testId: string; classroomId: string; title: string }
  | { kind: 'assignment.published'; assignmentId: string; classroomId: string; title: string; dueAt: string | null; totalMarks: number | null };

const APP_URL = () => (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://neuroclass.pages.dev').replace(/\/+$/, '');
const TZ = () => process.env.MAIL_TIMEZONE || 'Asia/Kolkata';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const formatWhen = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: TZ(), weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

function eventKey(e: NotificationEvent) {
  if (e.kind === 'test.published') return `test.published:${e.testId}`;
  if (e.kind === 'test.results_released') return `test.results_released:${e.testId}`;
  return `assignment.published:${e.assignmentId}`;
}

/** Plain, accessible HTML: one column, real text, a single button. */
function layout(heading: string, lines: Array<[string, string]>, intro: string, cta: { label: string; url: string }, classroom: string) {
  const rows = lines.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5f6368;font-size:14px;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;color:#202124;font-size:14px">${esc(v)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f8fafd;font-family:Inter,Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #dadce0;border-radius:8px">
<tr><td style="background:#1a73e8;border-radius:8px 8px 0 0;padding:20px 24px;color:#ffffff;font-size:14px">${esc(classroom)}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:20px;line-height:28px;color:#202124;font-weight:600">${esc(heading)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#5f6368">${esc(intro)}</p>
${rows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${rows}</table>` : ''}
<a href="${esc(cta.url)}" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:5px">${esc(cta.label)}</a>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e8eaed;color:#5f6368;font-size:12px;line-height:18px">You’re receiving this because you’re in ${esc(classroom)} on NeuroClass. To stop these emails, turn off email notifications in Settings: ${esc(APP_URL())}/student/settings</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${heading}\n\n${intro}\n\n${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${cta.label}: ${cta.url}\n\n—\nYou’re receiving this because you’re in ${classroom} on NeuroClass. To stop these emails, turn off email notifications in Settings: ${APP_URL()}/student/settings`;
  return { html, text };
}

export function renderEvent(e: NotificationEvent, classroom: string): { subject: string; html: string; text: string } {
  if (e.kind === 'test.published') {
    const lines: Array<[string, string]> = [];
    lines.push(['Opens', e.opensAt && new Date(e.opensAt).getTime() > Date.now() ? formatWhen(e.opensAt) : 'Now']);
    if (e.closesAt) lines.push(['Closes', formatWhen(e.closesAt)]);
    lines.push(['Duration', `${e.durationMinutes} minutes`]);
    if (e.totalMarks) lines.push(['Marks', String(e.totalMarks)]);
    if (e.proctored) lines.push(['Proctoring', 'Camera checks are on. Register Face ID beforehand if you haven’t.']);
    const intro = e.opensAt && new Date(e.opensAt).getTime() > Date.now() ? 'Your teacher has scheduled a new test.' : 'Your teacher has published a new test. It’s open now.';
    return { subject: `New test in ${classroom}: ${e.title}`, ...layout(e.title, lines, intro, { label: 'Open your tests', url: `${APP_URL()}/student/tests` }, classroom) };
  }
  if (e.kind === 'test.results_released') {
    return { subject: `Results released: ${e.title}`, ...layout(`Your results for ${e.title} are ready`, [], 'Your teacher has released the results for this test.', { label: 'See your results', url: `${APP_URL()}/student/history` }, classroom) };
  }
  const lines: Array<[string, string]> = [];
  if (e.dueAt) lines.push(['Due', formatWhen(e.dueAt)]);
  if (e.totalMarks) lines.push(['Marks', String(e.totalMarks)]);
  return { subject: `New assignment in ${classroom}: ${e.title}`, ...layout(e.title, lines, 'Your teacher has set a new assignment.', { label: 'Open your classes', url: `${APP_URL()}/student/classes` }, classroom) };
}

/** Enrolled students with an email address who haven't turned notifications off. */
export async function classroomRecipients(classroomId: string) {
  const { data: roster, error } = await db().from('students').select('email,user_id').eq('classroom_id', classroomId).limit(5000);
  if (error) throw error;
  const rows = (roster ?? []).filter((r: any) => typeof r.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()));
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
  const optedOut = new Set<string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await db().from('users').select('uid').in('uid', userIds.slice(i, i + 200)).eq('email_notifications', false);
    (data ?? []).forEach((u: any) => optedOut.add(u.uid));
  }
  const seen = new Set<string>();
  const out: Array<{ email: string; userId: string | null }> = [];
  for (const r of rows as Array<{ email: string; user_id: string | null }>) {
    const email = r.email.trim().toLowerCase();
    if (seen.has(email) || (r.user_id && optedOut.has(r.user_id))) continue;
    seen.add(email);
    out.push({ email, userId: r.user_id });
  }
  return out;
}

/** Sends pending outbox rows (optionally for one event). Returns counts. */
export async function flushOutbox(opts: { eventKey?: string; limit?: number; deadlineMs?: number } = {}) {
  const provider = getMailProvider();
  if (!provider) return { sent: 0, failed: 0, skipped: true };
  const deadline = Date.now() + (opts.deadlineMs ?? 8_000);
  let query = db().from('notification_outbox').select('id,recipient_email,subject,html,body_text,attempts').eq('status', 'pending').lt('attempts', 5).order('created_at').limit(opts.limit ?? 500);
  if (opts.eventKey) query = query.eq('event_key', opts.eventKey);
  const { data: rows, error } = await query;
  if (error) throw error;
  let sent = 0; let failed = 0;
  const pending = (rows ?? []) as Array<{ id: string; recipient_email: string; subject: string; html: string; body_text: string; attempts: number }>;
  for (let i = 0; i < pending.length && Date.now() < deadline; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const messages: MailMessage[] = chunk.map((r) => ({ to: r.recipient_email, subject: r.subject, html: r.html, text: r.body_text }));
    let results;
    try {
      results = await provider.sendBatch(messages);
    } catch (e) {
      results = chunk.map((r) => ({ to: r.recipient_email, ok: false, error: (e as Error).message?.slice(0, 200) ?? 'send failed' }));
    }
    const now = new Date().toISOString();
    await Promise.all(chunk.map((r, k) => {
      const res = results[k];
      if (res?.ok) { sent++; return db().from('notification_outbox').update({ status: 'sent', sent_at: now, attempts: r.attempts + 1, last_error: null }).eq('id', r.id); }
      failed++;
      return db().from('notification_outbox').update({ status: r.attempts + 1 >= 5 ? 'failed' : 'pending', attempts: r.attempts + 1, last_error: res?.error ?? 'unknown' }).eq('id', r.id);
    }));
  }
  return { sent, failed, skipped: false, provider: provider.name };
}

/**
 * Queues and sends an event to the classroom. Never throws: a mail problem
 * must not turn a successful publish into an error for the teacher.
 */
export async function notifyClassroom(event: NotificationEvent): Promise<{ queued: number; sent: number; failed: number; skipped: boolean }> {
  try {
    if (!getMailProvider()) return { queued: 0, sent: 0, failed: 0, skipped: true };
    const { data: classroom } = await db().from('classrooms').select('name').eq('id', event.classroomId).maybeSingle();
    const name = (classroom as any)?.name || 'your class';
    const recipients = await classroomRecipients(event.classroomId);
    if (!recipients.length) return { queued: 0, sent: 0, failed: 0, skipped: false };
    const key = eventKey(event);
    const content = renderEvent(event, name);
    const rows = recipients.map((r) => ({ event_key: key, kind: event.kind, classroom_id: event.classroomId, recipient_email: r.email, recipient_user_id: r.userId, subject: content.subject, html: content.html, body_text: content.text }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db().from('notification_outbox').upsert(rows.slice(i, i + 500), { onConflict: 'event_key,recipient_email', ignoreDuplicates: true });
      if (error) throw error;
    }
    const result = await flushOutbox({ eventKey: key });
    return { queued: rows.length, sent: result.sent, failed: result.failed, skipped: false };
  } catch (error) {
    console.error('[notify] failed', event.kind, (error as Error)?.message);
    return { queued: 0, sent: 0, failed: 0, skipped: false };
  }
}
