import nodemailer from 'nodemailer';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AttendanceEmailInput = {
  recipientEmail: string;
  studentName: string;
  className?: string;
  verifiedAt?: string;
  verifiedMethod?: string;
};

const cleanText = (value: unknown, maxLength: number, fallback: string) => {
  const text = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  return text || fallback;
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const configured = () => {
  const username = cleanText(process.env.GOOGLE_SMTP_USER, 320, '');
  const appPassword = cleanText(process.env.GOOGLE_SMTP_APP_PASSWORD, 200, '');
  return username && appPassword ? { username, appPassword } : null;
};

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey = '';

const getTransporter = (host: string, port: number, username: string, appPassword: string) => {
  const key = `${host}:${port}:${username}`;
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  cachedTransporterKey = key;
  return cachedTransporter;
};

export async function sendAttendanceConfirmationEmail(input: AttendanceEmailInput): Promise<boolean> {
  const recipientEmail = cleanText(input.recipientEmail, 320, '').toLowerCase();
  if (!recipientEmail || !EMAIL_PATTERN.test(recipientEmail)) {
    console.warn('[attendance.email] skipped invalid student email');
    return false;
  }

  const credentials = configured();
  if (!credentials) {
    console.warn('[attendance.email] skipped because Google Workspace SMTP is not configured');
    return false;
  }

  const host = cleanText(process.env.GOOGLE_SMTP_HOST, 120, 'smtp.gmail.com');
  const portValue = Number(process.env.GOOGLE_SMTP_PORT || 465);
  const port = Number.isFinite(portValue) && portValue > 0 && portValue <= 65535 ? portValue : 465;
  const from = cleanText(process.env.GOOGLE_SMTP_FROM, 320, credentials.username);
  const studentName = cleanText(input.studentName, 160, 'Student');
  const className = cleanText(input.className, 180, 'your NeuroClass class');
  const verifiedMethod = cleanText(input.verifiedMethod, 180, 'NeuroClass attendance verification');
  const verifiedAt = cleanText(input.verifiedAt, 120, new Date().toISOString());
  const subject = 'Attendance verified - NeuroClass';
  const text = [
    `Hello ${studentName},`,
    '',
    `Your attendance for ${className} has been successfully verified in NeuroClass.`,
    `Verification method: ${verifiedMethod}`,
    `Verified at: ${verifiedAt}`,
    '',
    'This is an automated confirmation. Please contact your teacher if anything looks incorrect.',
  ].join('\n');
  const html = `<p>Hello ${escapeHtml(studentName)},</p><p>Your attendance for <strong>${escapeHtml(className)}</strong> has been successfully verified in NeuroClass.</p><p><strong>Verification method:</strong> ${escapeHtml(verifiedMethod)}<br /><strong>Verified at:</strong> ${escapeHtml(verifiedAt)}</p><p>This is an automated confirmation. Please contact your teacher if anything looks incorrect.</p>`;

  try {
    const transporter = getTransporter(host, port, credentials.username, credentials.appPassword);
    await transporter.sendMail({ from, to: recipientEmail, subject, text, html });
    console.info('[attendance.email] confirmation sent', { recipientDomain: recipientEmail.split('@')[1] });
    return true;
  } catch (error) {
    console.warn('[attendance.email] delivery failed', error instanceof Error ? error.message : 'unknown error');
    return false;
  }
}
