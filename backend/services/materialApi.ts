import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseServiceRoleConfigured, supabase } from '../database/supabase';
import { withCors } from '../lib/cors';
import { normalizeBackendRole } from '../lib/roles';

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const EXTENSIONS = new Set(['pdf', 'txt', 'md', 'csv', 'json', 'docx']);
const json = (body: unknown, status = 200, req?: Request) => withCors(NextResponse.json(body, { status }), req?.headers.get('origin'));
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const getToken = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';

export type MaterialSourceType = 'local_upload' | 'google_drive';

export type PersistClassroomMaterialInput = {
  classroomId: string;
  uploaderId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  sourceType?: MaterialSourceType;
  driveFileId?: string | null;
  driveModifiedAt?: string | null;
  driveWebViewUrl?: string | null;
  deferExtraction?: boolean;
};

async function requireUser(request: Request, roles: string[] = []) {
  if (!isSupabaseServiceRoleConfigured()) throw Object.assign(new Error('Server database credentials are not configured.'), { status: 500 });
  const token = getToken(request);
  if (!token) throw Object.assign(new Error('Authentication is required.'), { status: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Authentication is invalid or expired.'), { status: 401 });
  const { data: profile } = await supabase.from('users').select('role').eq('uid', data.user.id).maybeSingle();
  const role = normalizeBackendRole(profile?.role);
  if (roles.length && !roles.includes(role) && !(role === 'admin' && roles.includes('admin'))) throw Object.assign(new Error('You do not have access to classroom materials.'), { status: 403 });
  return { user: data.user, role };
}

async function ownedClassroom(classroomId: string, userId: string) {
  const { data } = await supabase.from('classrooms').select('id,name,user_id').eq('id', classroomId).eq('user_id', userId).maybeSingle();
  if (!data) throw Object.assign(new Error('You do not own this classroom.'), { status: 403 });
  return data;
}

async function enrolledClassroom(classroomId: string, userId: string, email?: string | null) {
  const { data: byUser } = await supabase.from('students').select('id').eq('classroom_id', classroomId).eq('user_id', userId).maybeSingle();
  if (byUser) return;
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    const { data: byEmail } = await supabase.from('students').select('id').eq('classroom_id', classroomId).ilike('email', normalizedEmail).maybeSingle();
    if (byEmail) return;
  }
  throw Object.assign(new Error('You are not enrolled in this classroom.'), { status: 403 });
}

export async function authorizeClassroomRead(classroomId: string, userId: string, email?: string | null) {
  const { data: owned } = await supabase.from('classrooms').select('id').eq('id', classroomId).eq('user_id', userId).maybeSingle();
  if (owned) return 'teacher' as const;
  await enrolledClassroom(classroomId, userId, email);
  return 'student' as const;
}

const extensionFor = (name: string) => name.toLowerCase().split('.').pop() || '';
const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'material';
const supportedText = (mime: string, extension: string) => mime.startsWith('text/') || ['json', 'md', 'csv', 'txt'].includes(extension);
const chunkText = (text: string, size = 1800) => {
  const normalized = text.replace(/\u0000/g, '').replace(/\r/g, '').trim();
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += size) chunks.push(normalized.slice(index, index + size));
  return chunks.filter(Boolean);
};

export async function persistClassroomMaterial(input: PersistClassroomMaterialInput) {
  if (!input.classroomId || !input.uploaderId || !input.fileName || !input.mimeType) throw new Error('Material metadata is incomplete.');
  if (!ALLOWED_MIME.has(input.mimeType)) throw Object.assign(new Error('Unsupported material type. Upload PDF, DOCX, TXT, Markdown, CSV, or JSON.'), { status: 415 });
  if (!input.bytes.length || input.bytes.length > MAX_BYTES) throw Object.assign(new Error('Material must be between 1 byte and 15 MB.'), { status: 413 });

  const extension = extensionFor(input.fileName);
  if (!EXTENSIONS.has(extension)) throw Object.assign(new Error('Unsupported material extension.'), { status: 415 });
  const checksum = createHash('sha256').update(input.bytes).digest('hex');
  const bucket = process.env.CLASSROOM_MATERIALS_BUCKET || 'classroom-materials';
  const prefix = input.sourceType === 'google_drive' ? 'drive' : 'upload';
  const objectPath = `${input.classroomId}/${input.uploaderId}/${prefix}-${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, input.bytes, { contentType: input.mimeType, upsert: false });
  if (uploadError) throw Object.assign(new Error(`Private storage upload failed: ${uploadError.message}`), { status: 502 });

  const text = !input.deferExtraction && supportedText(input.mimeType, extension) ? input.bytes.toString('utf8').slice(0, 2_000_000) : null;
  const chunks = text ? chunkText(text) : [];
  const extractionStatus = text ? 'ready' : 'pending';
  const metadata = {
    originalName: input.fileName,
    ingestion: text ? 'inline-text' : 'worker-required',
    source: input.sourceType || 'local_upload',
    ...(input.driveFileId ? { driveFileId: input.driveFileId } : {}),
  };
  const { data: material, error: insertError } = await supabase.from('classroom_materials').insert({
    classroom_id: input.classroomId,
    uploader_id: input.uploaderId,
    name: input.fileName.slice(0, 240),
    storage_path: objectPath,
    mime_type: input.mimeType,
    extracted_text: text,
    extraction_status: extractionStatus,
    visibility: 'classroom',
    size_bytes: input.bytes.length,
    checksum_sha256: checksum,
    chunk_count: chunks.length,
    processed_at: text ? new Date().toISOString() : null,
    metadata,
    source_type: input.sourceType || 'local_upload',
    drive_file_id: input.driveFileId || null,
    drive_modified_at: input.driveModifiedAt || null,
    drive_web_view_url: input.driveWebViewUrl || null,
  }).select('id,classroom_id,name,mime_type,extraction_status,visibility,size_bytes,checksum_sha256,chunk_count,extraction_error,created_at,processed_at,source_type,drive_file_id,drive_modified_at').single();
  if (insertError || !material) {
    await supabase.storage.from(bucket).remove([objectPath]);
    if (insertError?.code === '23505') throw Object.assign(new Error('This Google Drive file is already imported into this classroom.'), { status: 409 });
    throw Object.assign(new Error('Material metadata could not be saved.'), { status: 500 });
  }

  if (chunks.length) {
    const { error: chunkError } = await supabase.from('classroom_material_chunks').insert(chunks.map((content, index) => ({ material_id: material.id, classroom_id: input.classroomId, chunk_index: index, content, token_count: Math.ceil(content.length / 4) })));
    if (chunkError) console.error('[materials.chunks]', chunkError.message);
  }
  return { material, message: extractionStatus === 'ready' ? 'Material processed and available to the classroom tutor.' : 'Material uploaded. A background worker will extract its text before the tutor can use it.' };
}

export async function uploadClassroomMaterial(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const form = await request.formData();
    const classroomId = clean(form.get('classroomId'), 80);
    const file = form.get('file');
    if (!classroomId || !(file instanceof File)) return json({ error: 'classroomId and file are required.' }, 400, request);
    const classroom = await ownedClassroom(classroomId, user.id);
    const result = await persistClassroomMaterial({ classroomId: classroom.id, uploaderId: user.id, fileName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()), sourceType: 'local_upload' });
    return json(result, 200, request);
  } catch (error: any) {
    return json({ error: error.message || 'Unable to upload classroom material.' }, error.status || 500, request);
  }
}

export async function listClassroomMaterials(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const classroomId = clean(new URL(request.url).searchParams.get('classroomId'), 80);
    if (!classroomId) return json({ error: 'classroomId is required.' }, 400, request);
    await authorizeClassroomRead(classroomId, user.id, user.email);
    const { data, error } = await supabase.from('classroom_materials').select('id,classroom_id,name,mime_type,extraction_status,visibility,size_bytes,checksum_sha256,chunk_count,extraction_error,created_at,processed_at,source_type,drive_file_id,drive_modified_at').eq('classroom_id', classroomId).eq('visibility', 'classroom').order('created_at', { ascending: false }).limit(100);
    if (error) return json({ error: 'Unable to load classroom materials.' }, 500, request);
    return json({ materials: data || [] }, 200, request);
  } catch (error: any) {
    return json({ error: error.message || 'Unable to load classroom materials.' }, error.status || 500, request);
  }
}

export async function downloadClassroomMaterial(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request);
    const url = new URL(request.url);
    const classroomId = clean(url.searchParams.get('classroomId'), 80);
    const materialId = clean(url.searchParams.get('materialId'), 80);
    if (!classroomId || !materialId) return json({ error: 'classroomId and materialId are required.' }, 400, request);
    await authorizeClassroomRead(classroomId, user.id, user.email);
    const { data: material, error } = await supabase.from('classroom_materials').select('id,name,mime_type,storage_path,visibility').eq('id', materialId).eq('classroom_id', classroomId).eq('visibility', 'classroom').maybeSingle();
    if (error || !material) return json({ error: 'Material not found.' }, 404, request);
    const bucket = process.env.CLASSROOM_MATERIALS_BUCKET || 'classroom-materials';
    const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(material.storage_path, 300);
    if (signedError || !signed?.signedUrl) return json({ error: 'Unable to prepare the material download.' }, 502, request);
    return json({ url: signed.signedUrl, expiresIn: 300, name: material.name, mimeType: material.mime_type }, 200, request);
  } catch (error: any) {
    return json({ error: error.message || 'Unable to download classroom material.' }, error.status || 500, request);
  }
}
