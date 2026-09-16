import { getSupabaseClient, subscribeWithFallback, fetchTableOnce } from './supabase';

/**
 * Small helpers for common table sync operations used by the app.
 * These functions are intentionally minimal — they centralize error logging
 * and provide a single place to tune polling intervals or subscription behavior.
 */

export async function loadBoletosFromSupabase() {
  try {
    return await fetchTableOnce('boletos');
  } catch (err) {
    console.error('[helpers] loadBoletosFromSupabase failed', err);
    return null;
  }
}

export async function loadCompaniesFromSupabase() {
  try {
    return await fetchTableOnce('companies');
  } catch (err) {
    console.error('[helpers] loadCompaniesFromSupabase failed', err);
    return null;
  }
}

export async function loadUserSessionsFromSupabase() {
  try {
    return await fetchTableOnce('user_sessions');
  } catch (err) {
    console.error('[helpers] loadUserSessionsFromSupabase failed', err);
    return null;
  }
}

/**
 * Example: start a subscription for boletos with fallback to polling.
 * The caller should keep the returned stop() and call it on unmount.
 */
export async function startBoletosSync(onChange: (payload: any) => void) {
  return await subscribeWithFallback('boletos', onChange, { pollIntervalMs: 15000 });
}

export async function startCompaniesSync(onChange: (payload: any) => void) {
  return await subscribeWithFallback('companies', onChange, { pollIntervalMs: 20000 });
}

export async function startUserSessionsSync(onChange: (payload: any) => void) {
  return await subscribeWithFallback('user_sessions', onChange, { pollIntervalMs: 10000 });
}
