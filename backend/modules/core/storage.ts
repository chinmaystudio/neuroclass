import { ApiError, db, dbFail } from './http';

export const ASSIGNMENT_BUCKET = process.env.ASSIGNMENT_FILES_BUCKET || 'assignment-files';

/** Extension → acceptable MIME types and leading magic bytes. */
const FILE_RULES: Record<string, { mimes: string[]; magic?: number[][] }> = {
  pdf: { mimes: ['application/pdf'], magic: [[0x25, 0x50, 0x44, 0x46]] },
  png: { mimes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47]] },
  jpg: { mimes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { mimes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  webp: { mimes: ['image/webp'], magic: [[0x52, 0x49, 0x46, 0x46]] },
  zip: { mimes: ['application/zip', 'application/x-zip-compressed'], magic: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]] },
  docx: { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  pptx: { mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  xlsx: { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  txt: { mimes: ['text/plain'] },
  md: { mimes: ['text/markdown', 'text/plain'] },
  csv: { mimes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'] },
  py: { mimes: ['text/x-python', 'text/plain', 'application/octet-stream'] },
  js: { mimes: ['text/javascript', 'application/javascript', 'text/plain'] },
  ts: { mimes: ['video/mp2t', 'text/plain', 'application/typescript', 'application/octet-stream'] },
  java: { mimes: ['text/x-java-source', 'text/plain', 'application/octet-stream'] },
  c: { mimes: ['text/x-c', 'text/plain', 'application/octet-stream'] },
  cpp: { mimes: ['text/x-c++src', 'text/plain', 'application/octet-stream'] },
  ipynb: { mimes: ['application/x-ipynb+json', 'application/json', 'application/octet-stream'] },
};
export const SUPPORTED_EXTENSIONS = Object.keys(FILE_RULES);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'py', 'js', 'ts', 'java', 'c', 'cpp', 'ipynb']);

export function safeFileName(name: string) {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.normalize('NFKC').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
}

export async function validateUpload(file: File, allowedExtensions: string[], maxBytes: number) {
  if (!(file instanceof File)) throw new ApiError(400, 'A file is required.', 'bad_request');
  if (file.size <= 0) throw new ApiError(400, 'The file is empty.', 'bad_request');
  if (file.size > maxBytes) throw new ApiError(413, `Each file must be smaller than ${Math.round(maxBytes / 1_048_576)} MB.`, 'payload_too_large');
  const name = safeFileName(file.name);
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const allowed = allowedExtensions.map((e) => e.toLowerCase().replace(/^\./, ''));
  if (!ext || !allowed.includes(ext) || !FILE_RULES[ext]) throw new ApiError(415, `Only these file types are accepted: ${allowed.join(', ')}.`, 'unsupported_media');
  const rule = FILE_RULES[ext];
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (rule.magic && !rule.magic.some((sig) => sig.every((b, i) => head[i] === b))) throw new ApiError(415, `The file content does not look like a valid .${ext} file.`, 'unsupported_media');
  if (TEXT_EXTENSIONS.has(ext)) {
    // Reject binary files renamed to a text extension.
    const sample = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    if (sample.some((b) => b === 0)) throw new ApiError(415, `The file does not look like a text .${ext} file.`, 'unsupported_media');
  }
  const mime = rule.mimes.includes(file.type) ? file.type : rule.mimes[0];
  return { name, ext, mime, size: file.size };
}

export async function putObject(path: string, file: File, mime: string) {
  const { error } = await db().storage.from(ASSIGNMENT_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: mime, upsert: false });
  if (error) dbFail('storage upload', { message: error.message });
}

export async function removeObjects(paths: string[]) {
  if (!paths.length) return;
  const { error } = await db().storage.from(ASSIGNMENT_BUCKET).remove(paths);
  if (error) console.error('[storage] remove failed', error.message);
}

/** Short-lived download URL; the storage path itself is never sent to the browser. */
export async function signedDownload(path: string, fileName: string) {
  const { data, error } = await db().storage.from(ASSIGNMENT_BUCKET).createSignedUrl(path, 120, { download: fileName });
  if (error || !data?.signedUrl) dbFail('storage sign', { message: error?.message });
  return { url: data.signedUrl, expiresInSeconds: 120 };
}
