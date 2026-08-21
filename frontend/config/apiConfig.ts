/**
 * API Configuration Utility for Decoupled Vercel Deployment
 * Configured via VITE_BACKEND_URL environment variable. When unset, requests
 * stay same-origin so frontend and Next.js API routes work from one deployment.
 */

export const getBackendBaseUrl = (): string => {
  const env = (import.meta as { env?: { VITE_BACKEND_URL?: string; PROD?: boolean } }).env;
  const url = env?.VITE_BACKEND_URL;
  // If building or running in production and VITE_BACKEND_URL points to localhost,
  // ignore it so requests fall back to same-origin relative paths.
  if (env?.PROD && url && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return '';
  }
  if (url && url.trim() !== '') {
    return url.replace(/\/$/, '');
  }
  // Same-origin fallback for deployments where frontend and backend share host.
  return '';
};

/**
 * Returns full API endpoint URL given a relative path (e.g. '/api/ai/generate-test')
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getBackendBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};
