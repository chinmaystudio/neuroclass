/**
 * Outgoing email. One provider is chosen with MAIL_PROVIDER:
 *   brevo  — BREVO_API_KEY            (free tier: verify a single sender address, no domain needed)
 *   resend — RESEND_API_KEY           (needs a verified domain to email anyone but yourself)
 *   smtp   — SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (e.g. Gmail with an app password)
 * plus MAIL_FROM ("NeuroClass <notifications@example.com>").
 * Each recipient gets their own message: classmates never see each other's addresses.
 */

export type MailMessage = { to: string; subject: string; html: string; text: string };
export type SendResult = { to: string; ok: boolean; error?: string };

export interface MailProvider {
  name: string;
  sendBatch(messages: MailMessage[]): Promise<SendResult[]>;
}

const TIMEOUT_MS = 10_000;

function parseFrom(raw: string) {
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, '') || 'NeuroClass', email: m[2] } : { name: 'NeuroClass', email: raw.trim() };
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

class BrevoProvider implements MailProvider {
  name = 'brevo';
  constructor(private key: string, private from: { name: string; email: string }) {}
  async sendBatch(messages: MailMessage[]) {
    // Same subject and body for everyone in a batch: use messageVersions (one
    // message per recipient, up to 1000 per call). Mixed batches go one by one.
    const first = messages[0];
    const uniform = messages.every((m) => m.subject === first.subject && m.html === first.html);
    if (uniform && messages.length > 1) {
      const res = await post('https://api.brevo.com/v3/smtp/email', { 'api-key': this.key }, {
        sender: this.from, subject: first.subject, htmlContent: first.html, textContent: first.text,
        messageVersions: messages.map((m) => ({ to: [{ email: m.to }] })),
      });
      return messages.map((m) => ({ to: m.to, ok: res.ok, error: res.ok ? undefined : `brevo ${res.status}: ${res.text.slice(0, 200)}` }));
    }
    const out: SendResult[] = [];
    for (const m of messages) {
      const res = await post('https://api.brevo.com/v3/smtp/email', { 'api-key': this.key }, { sender: this.from, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text });
      out.push({ to: m.to, ok: res.ok, error: res.ok ? undefined : `brevo ${res.status}: ${res.text.slice(0, 200)}` });
    }
    return out;
  }
}

class ResendProvider implements MailProvider {
  name = 'resend';
  constructor(private key: string, private from: string) {}
  async sendBatch(messages: MailMessage[]) {
    const out: SendResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await post('https://api.resend.com/emails/batch', { Authorization: `Bearer ${this.key}` }, chunk.map((m) => ({ from: this.from, to: [m.to], subject: m.subject, html: m.html, text: m.text })));
      chunk.forEach((m) => out.push({ to: m.to, ok: res.ok, error: res.ok ? undefined : `resend ${res.status}: ${res.text.slice(0, 200)}` }));
    }
    return out;
  }
}

class SmtpProvider implements MailProvider {
  name = 'smtp';
  private transport: Promise<any> | null = null;
  constructor(private from: string) {}
  private getTransport() {
    if (!this.transport) {
      this.transport = import('nodemailer').then((nodemailer) => nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        pool: true,
        maxConnections: 3,
        connectionTimeout: TIMEOUT_MS,
      }));
    }
    return this.transport;
  }
  async sendBatch(messages: MailMessage[]) {
    const transport = await this.getTransport();
    const out: SendResult[] = [];
    // A few at a time: SMTP servers (Gmail especially) throttle bursts.
    for (let i = 0; i < messages.length; i += 3) {
      const chunk = messages.slice(i, i + 3);
      const results = await Promise.allSettled(chunk.map((m) => transport.sendMail({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text })));
      results.forEach((r, k) => out.push({ to: chunk[k].to, ok: r.status === 'fulfilled', error: r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason).slice(0, 200) : undefined }));
    }
    return out;
  }
}

let override: MailProvider | null | undefined;
/** Test hook. */
export function __setMailProviderForTests(provider: MailProvider | null | undefined) { override = provider; }

/** The configured provider, or null when email is not set up (sending is then skipped). */
export function getMailProvider(): MailProvider | null {
  if (override !== undefined) return override;
  const kind = (process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  const from = (process.env.MAIL_FROM || '').trim();
  if (!kind || kind === 'disabled' || !from) return null;
  if (kind === 'brevo' && process.env.BREVO_API_KEY) return new BrevoProvider(process.env.BREVO_API_KEY, parseFrom(from));
  if (kind === 'resend' && process.env.RESEND_API_KEY) return new ResendProvider(process.env.RESEND_API_KEY, from);
  if (kind === 'smtp' && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return new SmtpProvider(from);
  return null;
}
