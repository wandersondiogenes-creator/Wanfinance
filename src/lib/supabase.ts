import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let supabaseClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client. Throws if required env vars are missing.
 * Use this in your app instead of creating multiple clients.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
      throw new Error('Supabase environment variables are not set. See README-SUPABASE-SETUP.md');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // increase visibility for debugging in Cloud Run logs
      // do not enable any sensitive logging in production
    });
    console.info('[supabase] Client created');
  }
  return supabaseClient;
}

export type SubscriptionStop = () => Promise<void> | void;

/**
 * Try to subscribe to real-time Postgres changes for a table. If realtime fails (no WS support,
 * blocked by host, auth or CORS), fall back to polling.
 *
 * Returns a stop() function to unsubscribe/stop polling.
 */
export async function subscribeWithFallback<T = any>(
  table: string,
  onChange: (payload: any) => void,
  opts?: { event?: string; schema?: string; pollIntervalMs?: number }
): Promise<SubscriptionStop> {
  const sb = getSupabaseClient();
  const schema = opts?.schema ?? 'public';
  const event = opts?.event ?? '*';
  const pollIntervalMs = opts?.pollIntervalMs ?? 15000;

  let channel: any | null = null;
  let pollingId: number | null = null;
  let lastSnapshot: string | null = null;

  // helper to fetch full table snapshot and call onChange with data
  async function doPollOnce() {
    try {
      const { data, error } = await sb.from(table).select('*');
      if (error) {
        console.warn('[supabase][poll] read error', table, error.message || error);
        return;
      }
      // rudimentary snapshot check to reduce duplicate callbacks
      const snapshot = JSON.stringify(data);
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        onChange({ type: 'poll', table, data });
      }
    } catch (err) {
      console.error('[supabase][poll] unexpected error', err);
    }
  }

  // attempt realtime subscription
  try {
    channel = sb
      .channel(`table-changes:${schema}.${table}`)
      .on('postgres_changes', { event: event, schema, table }, (payload: any) => {
        try {
          onChange({ type: 'realtime', table, payload });
        } catch (err) {
          console.error('[supabase][realtime] handler error', err);
        }
      });

    await channel.subscribe();

    // check subscription status
    const subState = channel?.state;
    console.info('[supabase][realtime] subscribed', table, 'state=', subState);

    // return stop function
    return async () => {
      try {
        if (channel) {
          await channel.unsubscribe();
          console.info('[supabase][realtime] unsubscribed', table);
        }
      } catch (err) {
        console.warn('[supabase][realtime] unsubscribe error', err);
      }
    };
  } catch (err) {
    console.warn('[supabase][realtime] realtime subscription failed, falling back to polling', err);
    // start polling
    await doPollOnce(); // initial fetch
    pollingId = window.setInterval(doPollOnce, pollIntervalMs);

    return async () => {
      if (pollingId) {
        clearInterval(pollingId);
        pollingId = null;
      }
    };
  }
}

/**
 * Utility: fetch a table once (simple wrapper with error logs)
 */
export async function fetchTableOnce<T = any>(table: string) {
  const sb = getSupabaseClient();
  try {
    const { data, error } = await sb.from<T>(table).select('*');
    if (error) {
      console.error('[supabase] fetchTableOnce error', table, error.message || error);
      throw error;
    }
    return data;
  } catch (err) {
    console.error('[supabase] fetchTableOnce unexpected error', err);
    throw err;
  }
}
