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

-- Allow public read/write
CREATE POLICY "Allow public all on companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on boletos" ON public.boletos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on cnab_history" ON public.cnab_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on user_sessions" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);
