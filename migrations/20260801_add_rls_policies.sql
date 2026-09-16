-- migrations/20260801_add_rls_policies.sql
-- Use this migration to enable RLS and add secure policies for testing/development.
-- REVIEW before applying in production.

-- Enable RLS on tables (idempotent)
ALTER TABLE IF EXISTS public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: allow SELECT to authenticated users
CREATE POLICY IF NOT EXISTS "authenticated_select_boletos" ON public.boletos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_select_companies" ON public.companies
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_select_user_sessions" ON public.user_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Example write policies for authenticated users (adjust as needed)
CREATE POLICY IF NOT EXISTS "authenticated_insert_boletos" ON public.boletos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_insert_companies" ON public.companies
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "authenticated_insert_user_sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- OPTIONAL: Public read (for quick testing) - COMMENTED OUT. Uncomment only for testing and remove later.
-- CREATE POLICY "public_read_boletos" ON public.boletos FOR SELECT USING (true);
-- CREATE POLICY "public_read_companies" ON public.companies FOR SELECT USING (true);
-- CREATE POLICY "public_read_user_sessions" ON public.user_sessions FOR SELECT USING (true);
