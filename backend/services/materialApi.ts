import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseServiceRoleConfigured, supabase } from '../database/supabase';
import { withCors } from '../lib/cors';

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

async function requireUser(request: Request, roles: string[] = []) {
  if (!isSupabaseServiceRoleConfigured()) throw Object.assign(new Error('Server database credentials are not configured.'), { status: 500 });
  const token = getToken(request);
  if (!token) throw Object.assign(new Error('Authentication is required.'), { status: 401 });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error('Authentication is invalid or expired.'), { status: 401 });
  const { data: profile } = await supabase.from('users').select('role').eq('uid', data.user.id).maybeSingle();
  const role = String(profile?.role || '');
  if (roles.length && !roles.includes(role)) throw Object.assign(new Error('You do not have access to classroom materials.'), { status: 403 });
  return { user: data.user, role };
}

async function ownedClassroom(classroomId: string, userId: string) {
  const { data } = await supabase.from('classrooms').select('id,name,user_id').eq('id', classroomId).eq('user_id', userId).maybeSingle();
  if (!data) throw Object.assign(new Error('You do not own this classroom.'), { status: 403 });
  return data;
}

async function enrolledClassroom(classroomId: string, userId: string) {
  const { data } = await supabase.from('students').select('id').eq('classroom_id', classroomId).eq('user_id', userId).maybeSingle();
  if (!data) throw Object.assign(new Error('You are not enrolled in this classroom.'), { status: 403 });
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

export async function uploadClassroomMaterial(request: Request): Promise<Response> {
  try {
    const { user } = await requireUser(request, ['teacher', 'instructor', 'admin']);
    const form = await request.formData();
    const classroomId = clean(form.get('classroomId'), 80);
    const file = form.get('file');
    if (!classroomId || !(file instanceof File)) return json({ error: 'classroomId and file are required.' }, 400, request);
    const classroom = await ownedClassroom(classroomId, user.id);
    const extension = extensionFor(file.name);
    if (!ALLOWED_MIME.has(file.type) || !EXTENSIONS.has(extension)) return json({ error: 'Unsupported material type. Upload PDF, DOCX, TXT, Markdown, CSV, or JSON.' }, 415, request);
    if (file.size <= 0 || file.size > MAX_BYTES) return json({ error: 'Material must be between 1 byte and 15 MB.' }, 413, request);

    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const objectPath = `${classroom.id}/${user.id}/${randomUUID()}-${sanitizeFileName(file.name)}`;
    const bucket = process.env.CLASSROOM_MATERIALS_BUCKET || 'classroom-materials';
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false });
    if (uploadError) return json({ error: `Private storage upload failed: ${uploadError.message}` }, 502, request);

    const text = supportedText(file.type, extension) ? (await file.text()).slice(0, 2_000_000) : null;
    const chunks = text ? chunkText(text) : [];
    const extractionStatus = text ? 'ready' : 'pending';
    const { data: material, error: insertError } = await supabase.from('classroom_materials').insert({
      classroom_id: classroom.id,
      uploader_id: user.id,
      name: file.name.slice(0, 240),
      storage_path: objectPath,
      mime_type: file.type,
      extracted_text: text,
      extraction_status: extractionStatus,
      visibility: 'classroom',
      size_bytes: file.size,
      checksum_sha256: checksum,
      chunk_count: chunks.length,
      processed_at: text ? new Date().toISOString() : null,
      metadata: { originalName: file.name, ingestion: text ? 'inline-text' : 'worker-required' },
    }).select('id,classroom_id,name,mime_type,extraction_status,visibility,size_bytes,checksum_sha256,chunk_count,extraction_error,created_at,processed_at').single();
    if (insertError || !material) {
      await supabase.storage.from(bucket).remove([objectPath]);
      return json({ error: 'Material metadata could not be saved.' }, 500, request);
    }

    if (chunks.length) {
      const { error: chunkError } = await supabase.from('classroom_material_chunks').insert(chunks.map((content, index) => ({ material_id: material.id, classroom_id: classroom.id, chunk_index: index, content, token_count: Math.ceil(content.length / 4) })));
      if (chunkError) console.error('[materials.chunks]', chunkError.message);
    }
    return json({ material, message: extractionStatus === 'ready' ? 'Material processed and available to the classroom tutor.' : 'Material uploaded. A background worker must extract its text before the tutor can use it.' }, 200, request);
  } catch (error: any) {
    return json({ error: error.message || 'Unable to upload classroom material.' }, error.status || 500, request);
  }
}

export async function listClassroomMaterials(request: Request): Promise<Response> {
  try {
    const { user, role } = await requireUser(request, ['teacher', 'instructor', 'admin', 'student']);
    const classroomId = clean(new URL(request.url).searchParams.get('classroomId'), 80);
    if (!classroomId) return json({ error: 'classroomId is required.' }, 400, request);
    if (['teacher', 'instructor', 'admin'].includes(role)) await ownedClassroom(classroomId, user.id);
    else await enrolledClassroom(classroomId, user.id);
    const { data, error } = await supabase.from('classroom_materials').select('id,classroom_id,name,mime_type,extraction_status,visibility,size_bytes,checksum_sha256,chunk_count,extraction_error,created_at,processed_at').eq('classroom_id', classroomId).eq('visibility', 'classroom').order('created_at', { ascending: false }).limit(100);
    if (error) return json({ error: 'Unable to load classroom materials.' }, 500, request);
    return json({ materials: data || [] }, 200, request);
  } catch (error: any) {
    return json({ error: error.message || 'Unable to load classroom materials.' }, error.status || 500, request);
  }
}
