import { supabase } from '../../database/supabase';
import { getApiUrl } from '../../config/apiConfig';

/** Error carrying the API's safe message, status and machine code. */
export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function token() {
  const { data } = await supabase.auth.getSession();
  const value = data.session?.access_token;
  if (!value) throw new ApiRequestError('Your session has expired. Please sign in again.', 401, 'unauthorized');
  return value;
}

async function request<T>(method: string, path: string, body?: unknown, init: { signal?: AbortSignal; form?: FormData; keepalive?: boolean; absolute?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}` };
  let payload: BodyInit | undefined;
  if (init.form) payload = init.form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let response: Response;
  try {
    response = await fetch(getApiUrl(init.absolute ? path : `/api/v1/${path}`), { method, headers, body: payload, signal: init.signal, keepalive: init.keepalive });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiRequestError('You appear to be offline. Your work is kept on this device and will be sent when you reconnect.', 0, 'network');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(data.details) && data.details.length ? ` (${data.details.map((d: { path: string; message: string }) => `${d.path ? `${d.path}: ` : ''}${d.message}`).join('; ')})` : '';
    throw new ApiRequestError(`${data.error || `Request failed (${response.status}).`}${data.code === 'bad_request' ? details : ''}`, response.status, data.code, data.details);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, { signal }),
  post: <T,>(path: string, body?: unknown, options?: { keepalive?: boolean }) => request<T>('POST', path, body ?? {}, options),
  put: <T,>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T,>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T,>(path: string) => request<T>('DELETE', path),
  /** For older non-versioned routes such as /api/ai/generate-test. */
  postLegacy: <T,>(path: string, body: unknown) => request<T>('POST', path, body, { absolute: true }),
  upload: <T,>(path: string, file: Blob, fileName = 'upload') => {
    const form = new FormData();
    form.append('file', file, fileName);
    return request<T>('POST', path, undefined, { form });
  },
};

/** Opens a short-lived signed download URL returned by the API. */
export async function openDownload(path: string) {
  const { url } = await api.get<{ url: string }>(path);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
