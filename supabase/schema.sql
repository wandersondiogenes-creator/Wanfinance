-- WANFINANCE SUPABASE SCHEMA QUICK COPY
-- Paste this script directly into Supabase Dashboard -> SQL Editor and click 'Run'

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies
CREATE TABLE IF NOT EXISTS public.companies (
    id VARCHAR(100) PRIMARY KEY,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj_cpf VARCHAR(20) NOT NULL,
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

-- Boletos
CREATE TABLE IF NOT EXISTS public.boletos (
    id VARCHAR(100) PRIMARY KEY,
    company_id VARCHAR(100),
    bank_account_id VARCHAR(100),
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CNAB History
CREATE TABLE IF NOT EXISTS public.cnab_history (
    id VARCHAR(100) PRIMARY KEY,
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
    boletos_json JSONB DEFAULT '[]'::jsonb
);

-- User Sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Gestor Financeiro',
    login_time VARCHAR(50)
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
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
DROP POLICY IF EXISTS "Allow public all on companies" ON public.companies;
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

-- 2. BOLETOS Granular Policies
DROP POLICY IF EXISTS "Allow public all on boletos" ON public.boletos;
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

-- 3. CNAB_HISTORY Granular Policies
DROP POLICY IF EXISTS "Allow public all on cnab_history" ON public.cnab_history;
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

-- 4. USER_SESSIONS Granular Policies
DROP POLICY IF EXISTS "Allow public all on user_sessions" ON public.user_sessions;
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
