/**
 * Centralized API Base URL helper for Cloud Run & Vercel hybrid deployment.
 *
 * - If VITE_API_URL environment variable is provided (e.g. "https://cnab-backend-xxxx.a.run.app"),
 *   requests are routed to Google Cloud Run.
 * - If VITE_API_URL is not set or empty, requests fallback to relative "/api/*" endpoints
 *   (Vercel Serverless Functions or local Express dev server).
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
};
