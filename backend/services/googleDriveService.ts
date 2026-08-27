import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { google, drive_v3 } from 'googleapis';
import { supabase } from '../database/supabase';

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
export const MAX_DRIVE_IMPORT_BYTES = 15 * 1024 * 1024;

export type DriveConnection = {
  id: string;
  teacher_user_id: string;
  google_email: string | null;
  encrypted_refresh_token: string;
  status: string;
};

export type ClassroomDriveFolder = {
  classroom_id: string;
  connection_id: string;
  drive_folder_id: string;
  folder_name: string;
};

export type DriveListItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured on the backend.`);
  return value;
}

function decodeKey(value: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must encode exactly 32 bytes.');
}

function encryptionKey(): Buffer {
  return decodeKey(required('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'));
}

function stateKey(): Buffer {
  const value = process.env.GOOGLE_DRIVE_STATE_SECRET?.trim();
  return value ? createHashKey(value) : encryptionKey();
}

function createHashKey(value: string): Buffer {
  return createHmac('sha256', 'neuroclass-google-drive-state').update(value).digest();
}

function encode(value: Buffer): string {
  return value.toString('base64url');
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function signState(payload: Record<string, string | number>): string {
  const body = encode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = createHmac('sha256', stateKey()).update(body).digest();
  return `${body}.${encode(signature)}`;
}

export function verifyState(value: string): Record<string, string | number> | null {
  try {
    const [body, encodedSignature] = value.split('.');
    if (!body || !encodedSignature) return null;
    const expected = createHmac('sha256', stateKey()).update(body).digest();
    const actual = decode(encodedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(decode(body).toString('utf8')) as Record<string, string | number>;
    if (typeof payload.issuedAt !== 'number' || Date.now() - payload.issuedAt > 10 * 60_000 || payload.issuedAt > Date.now() + 30_000) return null;
    if (typeof payload.userId !== 'string' || typeof payload.classroomId !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function createAuthorizationUrl(userId: string, classroomId: string): string {
  const oauth = new google.auth.OAuth2(required('GOOGLE_DRIVE_CLIENT_ID'), required('GOOGLE_DRIVE_CLIENT_SECRET'), required('GOOGLE_DRIVE_REDIRECT_URI'));
  const state = signState({ userId, classroomId, issuedAt: Date.now() });
  return oauth.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: [GOOGLE_DRIVE_SCOPE],
    state,
  });
}

export async function saveOAuthCode(code: string, userId: string): Promise<DriveConnection> {
  const oauth = new google.auth.OAuth2(required('GOOGLE_DRIVE_CLIENT_ID'), required('GOOGLE_DRIVE_CLIENT_SECRET'), required('GOOGLE_DRIVE_REDIRECT_URI'));
  const { tokens } = await oauth.getToken(code);
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) throw new Error('Google did not return a refresh token. Revoke the existing NeuroClass Drive grant and connect again.');
  oauth.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth });
  const about = await drive.about.get({ fields: 'user(emailAddress,displayName)' });
  const googleEmail = about.data.user?.emailAddress || null;
  const encrypted = encryptRefreshToken(refreshToken);
  const { data, error } = await supabase.from('google_drive_connections').upsert({
    teacher_user_id: userId,
    google_email: googleEmail,
    encrypted_refresh_token: encrypted,
    granted_scopes: [GOOGLE_DRIVE_SCOPE],
    status: 'connected',
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'teacher_user_id' }).select('id,teacher_user_id,google_email,encrypted_refresh_token,status').single();
  if (error || !data) throw new Error('Google Drive connection could not be saved securely.');
  return data as DriveConnection;
}

function encryptRefreshToken(refreshToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  return `v1.${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(ciphertext)}`;
}

function decryptRefreshToken(value: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedCiphertext) throw new Error('Stored Google Drive token format is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), decode(encodedIv));
  decipher.setAuthTag(decode(encodedTag));
  return Buffer.concat([decipher.update(decode(encodedCiphertext)), decipher.final()]).toString('utf8');
}

async function connectionForTeacher(userId: string): Promise<DriveConnection> {
  const { data, error } = await supabase.from('google_drive_connections').select('id,teacher_user_id,google_email,encrypted_refresh_token,status').eq('teacher_user_id', userId).eq('status', 'connected').maybeSingle();
  if (error || !data) throw new Error('Connect Google Drive before managing classroom material.');
  return data as DriveConnection;
}

async function driveForTeacher(userId: string): Promise<{ drive: drive_v3.Drive; connection: DriveConnection }> {
  const connection = await connectionForTeacher(userId);
  const oauth = new google.auth.OAuth2(required('GOOGLE_DRIVE_CLIENT_ID'), required('GOOGLE_DRIVE_CLIENT_SECRET'), required('GOOGLE_DRIVE_REDIRECT_URI'));
  oauth.setCredentials({ refresh_token: decryptRefreshToken(connection.encrypted_refresh_token) });
  return { drive: google.drive({ version: 'v3', auth: oauth }), connection };
}

function folderName(classroomName: string, classroomId: string): string {
  const cleanName = classroomName.replace(/[^a-zA-Z0-9 _-]/g, '_').trim().slice(0, 80) || 'Classroom';
  return `NeuroClass - ${cleanName} (${classroomId.slice(0, 8)})`;
}

export async function ensureClassroomFolder(userId: string, classroom: { id: string; name: string }): Promise<ClassroomDriveFolder> {
  const { data: existing } = await supabase.from('classroom_drive_folders').select('classroom_id,connection_id,drive_folder_id,folder_name').eq('classroom_id', classroom.id).maybeSingle();
  if (existing) {
    const { data: ownedConnection } = await supabase.from('google_drive_connections').select('id').eq('id', existing.connection_id).eq('teacher_user_id', userId).eq('status', 'connected').maybeSingle();
    if (!ownedConnection) throw new Error('This classroom is linked to a different Drive connection.');
    return existing as ClassroomDriveFolder;
  }

  const { drive, connection } = await driveForTeacher(userId);
  const name = folderName(classroom.name, classroom.id);
  const created = await drive.files.create({
    requestBody: { name, mimeType: DRIVE_FOLDER_MIME, parents: ['root'] },
    fields: 'id,name',
  });
  if (!created.data.id) throw new Error('Google Drive did not return the classroom folder ID.');
  const { data, error } = await supabase.from('classroom_drive_folders').insert({
    classroom_id: classroom.id,
    connection_id: connection.id,
    drive_folder_id: created.data.id,
    folder_name: name,
  }).select('classroom_id,connection_id,drive_folder_id,folder_name').single();
  if (error || !data) {
    await drive.files.delete({ fileId: created.data.id }).catch(() => undefined);
    throw new Error('Classroom Drive folder mapping could not be saved.');
  }
  return data as ClassroomDriveFolder;
}

export async function classroomFolderForTeacher(userId: string, classroomId: string): Promise<{ folder: ClassroomDriveFolder; drive: drive_v3.Drive }> {
  const { data: classroom } = await supabase.from('classrooms').select('id,name,user_id').eq('id', classroomId).eq('user_id', userId).maybeSingle();
  if (!classroom) throw Object.assign(new Error('You do not own this classroom.'), { status: 403 });
  const folder = await ensureClassroomFolder(userId, classroom);
  const { drive } = await driveForTeacher(userId);
  return { folder, drive };
}

export async function uploadToClassroomDrive(userId: string, classroomId: string, fileName: string, mimeType: string, bytes: Buffer): Promise<DriveListItem> {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  if (!supportedMimeType(mimeType) || !['pdf', 'txt', 'md', 'csv', 'json', 'docx'].includes(extension)) throw Object.assign(new Error('Unsupported material type. Upload PDF, DOCX, TXT, Markdown, CSV, or JSON.'), { status: 415 });
  if (!bytes.length || bytes.length > MAX_DRIVE_IMPORT_BYTES) throw Object.assign(new Error('Material must be between 1 byte and 15 MB.'), { status: 413 });
  const { folder, drive } = await classroomFolderForTeacher(userId, classroomId);
  const created = await drive.files.create({
    requestBody: { name: fileName.slice(0, 240), mimeType, parents: [folder.drive_folder_id] },
    media: { mimeType, body: Readable.from([bytes]) },
    fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
  });
  if (!created.data.id || !created.data.name) throw new Error('Google Drive did not return the uploaded file.');
  return {
    id: created.data.id,
    name: created.data.name,
    mimeType: created.data.mimeType || mimeType,
    size: created.data.size ? Number(created.data.size) : bytes.length,
    modifiedTime: created.data.modifiedTime || null,
    webViewLink: created.data.webViewLink || null,
  };
}

export async function listClassroomDriveFiles(userId: string, classroomId: string): Promise<{ folderName: string; files: DriveListItem[] }> {
  const { folder, drive } = await classroomFolderForTeacher(userId, classroomId);
  const response = await drive.files.list({
    q: `'${folder.drive_folder_id}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
    spaces: 'drive',
  });
  const files = (response.data.files || []).filter(file => file.id && file.name && file.mimeType !== DRIVE_FOLDER_MIME && supportedDriveFile(file)).map(file => ({
    id: file.id as string,
    name: file.name as string,
    mimeType: file.mimeType || 'application/octet-stream',
    size: file.size ? Number(file.size) : null,
    modifiedTime: file.modifiedTime || null,
    webViewLink: file.webViewLink || null,
  }));
  return { folderName: folder.folder_name, files };
}

function supportedMimeType(mimeType: string | null | undefined): boolean {
  return mimeType === GOOGLE_DOC_MIME || mimeType === 'application/pdf' || mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv' || mimeType === 'application/json' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function supportedDriveFile(file: drive_v3.Schema$File): boolean {
  return supportedMimeType(file.mimeType);
}

export async function downloadSelectedDriveFile(userId: string, classroomId: string, fileId: string): Promise<{ fileName: string; mimeType: string; bytes: Buffer; modifiedTime: string | null; webViewLink: string | null }> {
  const { folder, drive } = await classroomFolderForTeacher(userId, classroomId);
  const response = await drive.files.get({ fileId, fields: 'id,name,mimeType,size,modifiedTime,webViewLink,parents,trashed' });
  const file = response.data;
  if (!file.id || file.trashed || !file.parents?.includes(folder.drive_folder_id)) throw Object.assign(new Error('The selected file is not inside this classroom’s Drive folder.'), { status: 403 });
  if (!supportedDriveFile(file)) throw Object.assign(new Error('This file type cannot be imported yet. Use PDF, DOCX, TXT, Markdown, CSV, JSON, or a Google Doc.'), { status: 415 });
  if (file.size && Number(file.size) > MAX_DRIVE_IMPORT_BYTES) throw Object.assign(new Error('The selected material is larger than the 15 MB classroom limit.'), { status: 413 });

  if (file.mimeType === GOOGLE_DOC_MIME) {
    const exported = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'arraybuffer' });
    const bytes = Buffer.from(exported.data as ArrayBuffer);
    if (bytes.length > MAX_DRIVE_IMPORT_BYTES) throw Object.assign(new Error('The selected Google Doc is larger than the 15 MB classroom limit.'), { status: 413 });
    return { fileName: `${file.name || 'Google Doc'}.txt`, mimeType: 'text/plain', bytes, modifiedTime: file.modifiedTime || null, webViewLink: file.webViewLink || null };
  }

  const downloaded = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const bytes = Buffer.from(downloaded.data as ArrayBuffer);
  if (bytes.length > MAX_DRIVE_IMPORT_BYTES) throw Object.assign(new Error('The selected material is larger than the 15 MB classroom limit.'), { status: 413 });
  return { fileName: file.name || 'Drive material', mimeType: file.mimeType || 'application/octet-stream', bytes, modifiedTime: file.modifiedTime || null, webViewLink: file.webViewLink || null };
}

export function frontendOrigin(): string {
  return required('GOOGLE_DRIVE_FRONTEND_ORIGIN').replace(/\/$/, '');
}
