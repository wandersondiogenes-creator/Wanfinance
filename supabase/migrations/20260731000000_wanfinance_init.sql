-- ====================================================================
-- WANFINANCE ENTERPRISE - SUPABASE DATABASE INITIALIZATION MIGRATION
-- Generated: 2026-07-31
-- Target: Supabase PostgreSQL
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. COMPANIES TABLE (Empresas Pagadoras)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj_cpf VARCHAR(20) NOT NULL UNIQUE,
    logradouro VARCHAR(255),
    numero VARCHAR(50),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2) DEFAULT 'SP',
    cep VARCHAR(10),
    bancos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2. COMPANY BANKS TABLE (Contas Bancárias)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    banco_codigo VARCHAR(10) NOT NULL,
    banco_nome VARCHAR(100) NOT NULL,
    agencia VARCHAR(20) NOT NULL,
    conta VARCHAR(30) NOT NULL,
    carteira VARCHAR(10),
    chave_pix VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 3. BOLETOS TABLE (Títulos e Guias de Arrecadação)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boletos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    bank_account_id UUID,
    codigo_barras VARCHAR(60),
    linha_digitavel VARCHAR(60) NOT NULL,
    favorecido_nome VARCHAR(255) NOT NULL,
    favorecido_cnpj_cpf VARCHAR(20),
    valor NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    data_vencimento DATE,
    data_pagamento DATE,
    seu_numero VARCHAR(50),
    nosso_numero VARCHAR(50),
    banco_codigo VARCHAR(10) DEFAULT '001',
    status VARCHAR(30) DEFAULT 'pendente',
    selected BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for duplicate prevention and fast querying
CREATE INDEX IF NOT EXISTS idx_boletos_linha_digitavel ON public.boletos(linha_digitavel);
CREATE INDEX IF NOT EXISTS idx_boletos_company_id ON public.boletos(company_id);
CREATE INDEX IF NOT EXISTS idx_boletos_data_vencimento ON public.boletos(data_vencimento);

-- --------------------------------------------------------------------
-- 4. CNAB BATCH HISTORY TABLE (Histórico de Arquivos de Remessa)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cnab_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nsa INT NOT NULL,
    data_geracao TIMESTAMPTZ DEFAULT NOW(),
    empresa_nome VARCHAR(255) NOT NULL,
    banco_nome VARCHAR(100) NOT NULL,
    banco_codigo VARCHAR(10) NOT NULL,
    layout VARCHAR(10) NOT NULL DEFAULT '240',
    total_boletos INT DEFAULT 0,
    total_valor NUMERIC(15,2) DEFAULT 0.00,
    nome_arquivo VARCHAR(255) NOT NULL,
    conteudo_cnab TEXT NOT NULL,
    boletos_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cnab_history_nsa ON public.cnab_history(nsa);

-- --------------------------------------------------------------------
-- 5. USER SESSIONS TABLE (Sessões e Acessos)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Gestor Financeiro',
    login_time VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnab_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Helper functions for corporate security and RBAC
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
BEGIN
    RETURN COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
        (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role'),
        (SELECT role FROM public.user_sessions WHERE user_id = auth.uid()::text LIMIT 1),
        'OPERADOR'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (
        auth.role() = 'service_role' OR
        public.get_current_user_role() IN ('Super Admin', 'Administrador Geral', 'ADMINISTRADOR')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. COMPANIES Granular Policies
DROP POLICY IF EXISTS "Allow public full access to companies" ON public.companies;
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;

CREATE POLICY "companies_select_policy" ON public.companies
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "companies_insert_policy" ON public.companies
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'));

CREATE POLICY "companies_update_policy" ON public.companies
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'))
    WITH CHECK (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'));

CREATE POLICY "companies_delete_policy" ON public.companies
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 2. COMPANY_BANKS Granular Policies
DROP POLICY IF EXISTS "Allow public full access to company_banks" ON public.company_banks;
DROP POLICY IF EXISTS "company_banks_select_policy" ON public.company_banks;
DROP POLICY IF EXISTS "company_banks_insert_policy" ON public.company_banks;
DROP POLICY IF EXISTS "company_banks_update_policy" ON public.company_banks;
DROP POLICY IF EXISTS "company_banks_delete_policy" ON public.company_banks;

CREATE POLICY "company_banks_select_policy" ON public.company_banks
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "company_banks_insert_policy" ON public.company_banks
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'));

CREATE POLICY "company_banks_update_policy" ON public.company_banks
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'))
    WITH CHECK (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'));

CREATE POLICY "company_banks_delete_policy" ON public.company_banks
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 3. BOLETOS Granular Policies
DROP POLICY IF EXISTS "Allow public full access to boletos" ON public.boletos;
DROP POLICY IF EXISTS "boletos_select_policy" ON public.boletos;
DROP POLICY IF EXISTS "boletos_insert_policy" ON public.boletos;
DROP POLICY IF EXISTS "boletos_update_policy" ON public.boletos;
DROP POLICY IF EXISTS "boletos_delete_policy" ON public.boletos;

CREATE POLICY "boletos_select_policy" ON public.boletos
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "boletos_insert_policy" ON public.boletos
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() NOT IN ('CONSULTA', 'AUDITORIA'));

CREATE POLICY "boletos_update_policy" ON public.boletos
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() NOT IN ('CONSULTA', 'AUDITORIA'))
    WITH CHECK (public.get_current_user_role() NOT IN ('CONSULTA', 'AUDITORIA'));

CREATE POLICY "boletos_delete_policy" ON public.boletos
    FOR DELETE TO authenticated
    USING (public.is_admin() OR public.get_current_user_role() IN ('Gestor Financeiro', 'OPERADOR'));

-- 4. CNAB_HISTORY Granular Policies
DROP POLICY IF EXISTS "Allow public full access to cnab_history" ON public.cnab_history;
DROP POLICY IF EXISTS "cnab_history_select_policy" ON public.cnab_history;
DROP POLICY IF EXISTS "cnab_history_insert_policy" ON public.cnab_history;
DROP POLICY IF EXISTS "cnab_history_update_policy" ON public.cnab_history;
DROP POLICY IF EXISTS "cnab_history_delete_policy" ON public.cnab_history;

CREATE POLICY "cnab_history_select_policy" ON public.cnab_history
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "cnab_history_insert_policy" ON public.cnab_history
    FOR INSERT TO authenticated
    WITH CHECK (public.get_current_user_role() NOT IN ('CONSULTA', 'AUDITORIA'));

CREATE POLICY "cnab_history_update_policy" ON public.cnab_history
    FOR UPDATE TO authenticated
    USING (public.get_current_user_role() NOT IN ('CONSULTA', 'AUDITORIA'))
    WITH CHECK (public.get_current_user_role() NOT IN ('CONSULTA', 'AUDITORIA'));

CREATE POLICY "cnab_history_delete_policy" ON public.cnab_history
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- 5. USER_SESSIONS Granular Policies
DROP POLICY IF EXISTS "Allow public full access to user_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_select_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_insert_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_update_policy" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions_delete_policy" ON public.user_sessions;

CREATE POLICY "user_sessions_select_policy" ON public.user_sessions
    FOR SELECT TO authenticated
    USING (auth.uid()::text = user_id OR public.is_admin());

CREATE POLICY "user_sessions_insert_policy" ON public.user_sessions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid()::text = user_id OR public.is_admin());

CREATE POLICY "user_sessions_update_policy" ON public.user_sessions
    FOR UPDATE TO authenticated
    USING (auth.uid()::text = user_id OR public.is_admin())
    WITH CHECK (auth.uid()::text = user_id OR public.is_admin());

CREATE POLICY "user_sessions_delete_policy" ON public.user_sessions
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- --------------------------------------------------------------------
-- 7. TRIGGER FOR AUTOMATIC UPDATED_AT TIMESTAMP
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_modtime
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_boletos_modtime
    BEFORE UPDATE ON public.boletos
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_user_sessions_modtime
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
