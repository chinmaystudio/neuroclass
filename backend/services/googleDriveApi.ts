import { NextResponse } from 'next/server';
import { supabase } from '../database/supabase';
import { withCors } from '../lib/cors';
import { requireAuth, boundedString } from '../lib/requireAuth';
import { authorizeClassroomRead, persistClassroomMaterial } from './materialApi';
import {
  createAuthorizationUrl,
  downloadSelectedDriveFile,
  ensureClassroomFolder,
  frontendOrigin,
  listClassroomDriveFiles,
  saveOAuthCode,
  uploadToClassroomDrive,
  verifyState,
} from './googleDriveService';

const json = (request: Request, body: unknown, status = 200) => withCors(NextResponse.json(body, { status }), request.headers.get('origin'));
const redirect = (url: string, status = 302) => NextResponse.redirect(url, status);

function classroomIdFrom(request: Request): string {
  return boundedString(new URL(request.url).searchParams.get('classroomId'), 80);
}

export async function connectGoogleDrive(request: Request): Promise<Response> {
  const auth = await requireAuth(request as any);
  if ('response' in auth) return auth.response;
  try {
    const classroomId = classroomIdFrom(request);
    if (!classroomId) return json(request, { error: 'classroomId is required.' }, 400);
    const { data: classroom } = await supabase.from('classrooms').select('id,name').eq('id', classroomId).eq('user_id', auth.userId).maybeSingle();
    if (!classroom) return json(request, { error: 'You do not own this classroom.' }, 403);
    return json(request, { authorizationUrl: createAuthorizationUrl(auth.userId, classroomId) });
  } catch (error: any) {
    return json(request, { error: error.message || 'Google Drive connection is not configured.' }, 500);
  }
}

export async function googleDriveCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const state = boundedString(url.searchParams.get('state'), 2000);
  const code = boundedString(url.searchParams.get('code'), 4000);
  const error = boundedString(url.searchParams.get('error'), 120);
  const payload = state ? verifyState(state) : null;
  const fallback = frontendOrigin();
  if (!payload || typeof payload.userId !== 'string' || typeof payload.classroomId !== 'string') return redirect(`${fallback}/teacher?drive=error&reason=invalid_state`);
  const resultUrl = `${fallback}/teacher?classroomId=${encodeURIComponent(payload.classroomId)}&drive=`;
  if (error || !code) return redirect(`${resultUrl}denied`);
  try {
    const { data: classroom } = await supabase.from('classrooms').select('id,name').eq('id', payload.classroomId).eq('user_id', payload.userId).maybeSingle();
    if (!classroom) return redirect(`${fallback}/teacher?drive=error&reason=classroom_access`);
    await saveOAuthCode(code, payload.userId);
    await ensureClassroomFolder(payload.userId, classroom);
    return redirect(`${resultUrl}connected`);
  } catch (callbackError) {
    console.error('[google-drive.callback]', callbackError instanceof Error ? callbackError.message : 'callback failed');
    return redirect(`${resultUrl}error&reason=connection_failed`);
  }
}

export async function driveConnectionStatus(request: Request): Promise<Response> {
  const auth = await requireAuth(request as any);
  if ('response' in auth) return auth.response;
  try {
    const classroomId = classroomIdFrom(request);
    if (!classroomId) return json(request, { error: 'classroomId is required.' }, 400);
    const { data: classroom } = await supabase.from('classrooms').select('id,name').eq('id', classroomId).eq('user_id', auth.userId).maybeSingle();
    if (!classroom) return json(request, { error: 'You do not own this classroom.' }, 403);
    const { data: connection } = await supabase.from('google_drive_connections').select('id,google_email,status').eq('teacher_user_id', auth.userId).eq('status', 'connected').maybeSingle();
    let folder = null;
    if (connection) {
      folder = await ensureClassroomFolder(auth.userId, classroom);
    }
    return json(request, { connected: Boolean(connection), googleEmail: connection?.google_email || null, folder: folder || null });
  } catch (error: any) {
    return json(request, { error: error.message || 'Unable to load Google Drive status.' }, 500);
  }
}

export async function uploadDriveFile(request: Request): Promise<Response> {
  const auth = await requireAuth(request as any);
  if ('response' in auth) return auth.response;
  try {
    const form = await request.formData();
    const classroomId = boundedString(form.get('classroomId'), 80);
    const file = form.get('file');
    if (!classroomId || !(file instanceof File)) return json(request, { error: 'classroomId and file are required.' }, 400);
    const { data: classroom } = await supabase.from('classrooms').select('id,name').eq('id', classroomId).eq('user_id', auth.userId).maybeSingle();
    if (!classroom) return json(request, { error: 'You do not own this classroom.' }, 403);
    const driveFile = await uploadToClassroomDrive(auth.userId, classroomId, file.name, file.type, Buffer.from(await file.arrayBuffer()));
    const imported = await downloadSelectedDriveFile(auth.userId, classroomId, driveFile.id);
    const result = await persistClassroomMaterial({
      classroomId,
      uploaderId: auth.userId,
      fileName: imported.fileName,
      mimeType: imported.mimeType,
      bytes: imported.bytes,
      sourceType: 'google_drive',
      driveFileId: driveFile.id,
      driveModifiedAt: imported.modifiedTime,
      driveWebViewUrl: imported.webViewLink,
      deferExtraction: false,
    });
    return json(request, { ...result, driveFile });
  } catch (error: any) {
    return json(request, { error: error.message || 'Unable to upload material to Google Drive.' }, error.status || 500);
  }
}

export async function listDriveFiles(request: Request): Promise<Response> {
  const auth = await requireAuth(request as any);
  if ('response' in auth) return auth.response;
  try {
    const classroomId = classroomIdFrom(request);
    if (!classroomId) return json(request, { error: 'classroomId is required.' }, 400);
    const result = await listClassroomDriveFiles(auth.userId, classroomId);
    return json(request, result);
  } catch (error: any) {
    return json(request, { error: error.message || 'Unable to list classroom Drive files.' }, error.status || 500);
  }
}

export async function importDriveFile(request: Request): Promise<Response> {
  const auth = await requireAuth(request as any);
  if ('response' in auth) return auth.response;
  try {
    const input = await request.json().catch(() => ({}));
    const classroomId = boundedString(input?.classroomId, 80);
    const fileId = boundedString(input?.fileId, 200);
    if (!classroomId || !fileId) return json(request, { error: 'classroomId and fileId are required.' }, 400);
    const { data: classroom } = await supabase.from('classrooms').select('id,name').eq('id', classroomId).eq('user_id', auth.userId).maybeSingle();
    if (!classroom) return json(request, { error: 'You do not own this classroom.' }, 403);
    const { data: existing } = await supabase.from('classroom_materials').select('id,name,extraction_status').eq('classroom_id', classroomId).eq('drive_file_id', fileId).maybeSingle();
    if (existing) return json(request, { error: 'This Google Drive file is already imported into this classroom.', material: existing }, 409);
    const driveFile = await downloadSelectedDriveFile(auth.userId, classroomId, fileId);
    const result = await persistClassroomMaterial({
      classroomId,
      uploaderId: auth.userId,
      fileName: driveFile.fileName,
      mimeType: driveFile.mimeType,
      bytes: driveFile.bytes,
      sourceType: 'google_drive',
      driveFileId: fileId,
      driveModifiedAt: driveFile.modifiedTime,
      driveWebViewUrl: driveFile.webViewLink,
      deferExtraction: false,
    });
    return json(request, result);
  } catch (error: any) {
    return json(request, { error: error.message || 'Unable to import the selected Drive file.' }, error.status || 500);
  }
}

export async function studentMaterialDownload(request: Request): Promise<Response> {
  const auth = await requireAuth(request as any);
  if ('response' in auth) return auth.response;
  try {
    const classroomId = classroomIdFrom(request);
    const materialId = boundedString(new URL(request.url).searchParams.get('materialId'), 80);
    if (!classroomId || !materialId) return json(request, { error: 'classroomId and materialId are required.' }, 400);
    await authorizeClassroomRead(classroomId, auth.userId, auth.userEmail);
    const { data: material, error } = await supabase.from('classroom_materials').select('id,name,mime_type,storage_path,visibility').eq('id', materialId).eq('classroom_id', classroomId).eq('visibility', 'classroom').maybeSingle();
    if (error || !material) return json(request, { error: 'Material not found.' }, 404);
    const bucket = process.env.CLASSROOM_MATERIALS_BUCKET || 'classroom-materials';
    const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUrl(material.storage_path, 300);
    if (signedError || !signed?.signedUrl) return json(request, { error: 'Unable to prepare the material download.' }, 502);
    return json(request, { url: signed.signedUrl, expiresIn: 300, name: material.name, mimeType: material.mime_type });
  } catch (error: any) {
    return json(request, { error: error.message || 'Unable to download classroom material.' }, error.status || 500);
  }
}
