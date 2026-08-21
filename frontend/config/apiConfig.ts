/**
 * API Configuration Utility for Decoupled Vercel Deployment
 * Configured via VITE_API_URL environment variable. VITE_BACKEND_URL remains
 * supported as a backward-compatible alias. When unset, requests
 * stay same-origin so frontend and Next.js API routes work from one deployment.
 */

const DEFAULT_PRODUCTION_API_URL = 'https://neuroclass-swart.vercel.app';

export const getBackendBaseUrl = (): string => {
  const env = (import.meta as { env?: { VITE_API_URL?: string; VITE_BACKEND_URL?: string; PROD?: boolean } }).env;
  const url = env?.VITE_API_URL || env?.VITE_BACKEND_URL;
  // If building or running in production and VITE_BACKEND_URL points to localhost,
  // ignore it so requests fall back to same-origin relative paths.
  if (env?.PROD && url && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return DEFAULT_PRODUCTION_API_URL;
  }
  if (url && url.trim() !== '') {
    return url.replace(/\/$/, '');
  }
  // Cloudflare Pages hosts the frontend separately from the Vercel gateway.
  // Keep local development same-origin, but never send production attendance
  // requests to a static Cloudflare host when VITE_API_URL is missing.
  return env?.PROD ? DEFAULT_PRODUCTION_API_URL : '';
};

/**
 * Returns full API endpoint URL given a relative path (e.g. '/api/ai/generate-test')
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getBackendBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};
