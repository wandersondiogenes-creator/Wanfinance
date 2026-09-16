Wanfinance - Supabase integration notes

This file documents the changes made in branch fix/supabase-realtime-fallback and how to test them.

Files added/updated in branch:
- src/lib/supabase.ts (singleton client + subscribeWithFallback + fetchTableOnce)
- src/lib/supabaseHelpers.ts (convenience helpers: load/start sync for boletos, companies, user_sessions)
- migrations/20260801_add_rls_policies.sql (RLS enable + authenticated policies)
- README-SUPABASE-SETUP.md (this file)

Environment variables (Google Cloud Run)
- In Cloud Run set the following variables for the container (these names match Vite import.meta.env keys):
  - VITE_SUPABASE_URL = https://<project-ref>.supabase.co
  - VITE_SUPABASE_ANON_KEY = <anon-public-key>

Do NOT put the SERVICE_ROLE key in environment variables exposed to the browser or committed to the repo.

Quick manual tests (run locally or in the browser console):
1) REST (curl) test - run from any machine with the anon key:
  curl -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" "https://<project-ref>.supabase.co/rest/v1/boletos?select=*"

2) Browser console (supabase-js v2 must be available in your bundle):
  const sb = supabaseJs.createClient('https://<project-ref>.supabase.co','<ANON_KEY>');
  await sb.from('boletos').select('*').then(console.log).catch(console.error);

3) Using the new helpers in the app (example snippet to paste in App.tsx or a component):

  import { startBoletosSync } from './lib/supabaseHelpers';

  useEffect(() => {
    let stop: any;
    (async () => {
      stop = await startBoletosSync(payload => {
        console.log('boletos change', payload);
        // update state here
      });
    })();

    return () => { if (stop) stop(); };
  }, []);

Realtime debugging
- Open browser DevTools -> Network -> WS (or filter wss) and look for a connection to https://<project-ref>.supabase.co/realtime
- If WS is blocked by the host (Cloud Run) or by a proxy, the helpers will fall back to polling. Check Cloud Run logs for errors.

Applying SQL policies to Supabase database
- Use psql, the SQL editor in Supabase Dashboard, or your migration tooling to apply migrations/20260801_add_rls_policies.sql
- By default the migration creates authenticated-only policies. If you want to allow public read for quick testing,
  uncomment the "public_read_*" policy lines, apply the migration, test, then revert.

Checklist after merging PR
- Verify environment variables set in Cloud Run and redeploy the container.
- Run the curl test above and confirm new rows appear.
- Open the site, monitor console logs and network WS connections.
- If Looker/AI Studio connectors read from Supabase, trigger a manual refresh of the connector / data source.

If anything fails, paste console logs and I will iterate on the fix.
