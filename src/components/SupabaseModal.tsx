import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  RefreshCw,
  Key,
  Globe,
  X,
  Code2,
  Sparkles,
  Server,
  Layers,
  ArrowUpRight,
  UploadCloud,
  DownloadCloud,
} from 'lucide-react';
import {
  getStoredSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
  reinitSupabaseClient,
  syncCompanyProfilesToSupabase,
  syncBoletosToSupabase,
  syncHistoryToSupabase,
  fetchCompanyProfilesFromSupabase,
  fetchBoletosFromSupabase,
  fetchHistoryFromSupabase,
} from '../lib/supabase';
import { CompanyProfile, BoletoItem, CNABBatchHistory } from '../types';
import { saveCompanyProfiles, saveBoletos, saveHistory } from '../utils/storage';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyProfile[];
  boletos: BoletoItem[];
  history: CNABBatchHistory[];
  onToast: (msg: string) => void;
  onReloadFromSupabase?: (data: {
    companies?: CompanyProfile[];
    boletos?: BoletoItem[];
    history?: CNABBatchHistory[];
  }) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  companies,
  boletos,
  history,
  onToast,
  onReloadFromSupabase,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'migration' | 'tables'>('config');

  useEffect(() => {
    if (isOpen) {
      const creds = getStoredSupabaseCredentials();
      if (creds) {
        setUrl(creds.url);
        setAnonKey(creds.anonKey);
        handleTestConnection(creds);
      }
    }
  }, [isOpen]);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, preencha a URL do Projeto e a Anon Key do Supabase.',
      });
      return;
    }

    const creds = { url: url.trim(), anonKey: anonKey.trim() };
    saveSupabaseCredentials(creds);
    reinitSupabaseClient();
    await handleTestConnection(creds);
  };

  const handleTestConnection = async (credsToTest?: { url: string; anonKey: string }) => {
    setIsTesting(true);
    setTestResult(null);
    const res = await testSupabaseConnection(credsToTest);
    setIsTesting(false);
    setTestResult(res);
  };

  const handlePushToSupabase = async () => {
    setIsSyncing(true);
    const cRes = await syncCompanyProfilesToSupabase(companies);
    const bRes = await syncBoletosToSupabase(boletos);
    const hRes = await syncHistoryToSupabase(history);
    setIsSyncing(false);

    if (cRes.success && bRes.success && hRes.success) {
      onToast(`Sucesso! ${cRes.count} empresas, ${bRes.count} boletos e ${hRes.count} remessas enviadas ao Supabase.`);
    } else {
      const err = cRes.error || bRes.error || hRes.error || 'Erro na sincronização';
      onToast(`Aviso na sincronização com Supabase: ${err}`);
    }
  };

  const handlePullFromSupabase = async () => {
    if (!onReloadFromSupabase) return;
    setIsPulling(true);
    const fetchedCompanies = await fetchCompanyProfilesFromSupabase();
    const fetchedBoletos = await fetchBoletosFromSupabase();
    const fetchedHistory = await fetchHistoryFromSupabase();
    setIsPulling(false);

    if (fetchedCompanies || fetchedBoletos || fetchedHistory) {
      onReloadFromSupabase({
        companies: fetchedCompanies || undefined,
        boletos: fetchedBoletos || undefined,
        history: fetchedHistory || undefined,
      });
      onToast('Dados recarregados com sucesso a partir do Supabase!');
    } else {
      onToast('Não foi possível carregar do Supabase. Verifique a conexão e as tabelas.');
    }
  };

  const sqlMigrationCode = `-- WANFINANCE ENTERPRISE - SUPABASE SQL MIGRATION
-- Copie e execute no SQL Editor do seu projeto Supabase (https://supabase.com)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Empresas e Contas Bancárias
CREATE TABLE IF NOT EXISTS public.companies (
    id VARCHAR(100) PRIMARY KEY,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj_cpf VARCHAR(20) NOT NULL,
    tipo_inscricao VARCHAR(10) DEFAULT 'CNPJ',
    logradouro VARCHAR(255),
    numero VARCHAR(50),
    complemento VARCHAR(255),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(10) DEFAULT 'SP',
    cep VARCHAR(20),
    bancos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualização de esquema (garantir colunas novas se a tabela já existia)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tipo_inscricao VARCHAR(10) DEFAULT 'CNPJ';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS complemento VARCHAR(255);

-- 2. Tabela de Boletos e Faturas
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
    banco_nome VARCHAR(100),
    status VARCHAR(30) DEFAULT 'pendente',
    selected BOOLEAN DEFAULT true,
    categoria VARCHAR(100),
    observacoes TEXT,
    desconto NUMERIC(15,2) DEFAULT 0.00,
    juros_multa NUMERIC(15,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualização de esquema (garantir colunas se a tabela já existia)
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS banco_nome VARCHAR(100);
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS desconto NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE public.boletos ADD COLUMN IF NOT EXISTS juros_multa NUMERIC(15,2) DEFAULT 0.00;

-- 3. Histórico de Remessas CNAB
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

-- 4. Sessões de Usuários
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Gestor Financeiro',
    login_time VARCHAR(50)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnab_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público
DROP POLICY IF EXISTS "Allow public all on companies" ON public.companies;
CREATE POLICY "Allow public all on companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on boletos" ON public.boletos;
CREATE POLICY "Allow public all on boletos" ON public.boletos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on cnab_history" ON public.cnab_history;
CREATE POLICY "Allow public all on cnab_history" ON public.cnab_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on user_sessions" ON public.user_sessions;
CREATE POLICY "Allow public all on user_sessions" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    onToast('Migration SQL copiado para a área de transferência!');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([sqlMigrationCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '20260731000000_wanfinance_supabase_init.sql';
    link.click();
    URL.revokeObjectURL(url);
    onToast('Arquivo de migration SQL baixado!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Integração & Migrations Supabase
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-md border border-emerald-500/30">
                  PostgreSQL
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Conecte o banco relacional Supabase e gerencie os scripts de migration da Wanfinance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-3 font-semibold text-xs transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Configuração & Conexão</span>
          </button>

          <button
            onClick={() => setActiveTab('migration')}
            className={`px-4 py-3 font-semibold text-xs transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === 'migration'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Script SQL Migration</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-3 font-semibold text-xs transition-all border-b-2 flex items-center space-x-2 ${
              activeTab === 'tables'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sincronização de Dados</span>
          </button>
        </div>

        {/* Tab 1: Config & Credentials */}
        {activeTab === 'config' && (
          <div className="p-6 space-y-6">
            <form onSubmit={handleSaveAndTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  URL do Projeto Supabase
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  Supabase Anon Key (Chave Pública API)
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhY2Nlc3NfdG9rZW4iOi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs flex items-start space-x-3 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-bold text-sm mb-0.5">
                      {testResult.success ? 'Conectado com Sucesso' : 'Falha na Conexão'}
                    </strong>
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Criar conta gratuita no Supabase
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>

                <button
                  type="submit"
                  disabled={isTesting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testando Conexão...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar & Testar Conexão</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: SQL Migration */}
        {activeTab === 'migration' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Script de DDL / Migration para Supabase
                </h3>
                <p className="text-xs text-slate-400">
                  Execute esta migration no Supabase SQL Editor para criar a estrutura das tabelas da Wanfinance
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopySql}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>

                <button
                  onClick={handleDownloadSql}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-md transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar .sql</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-h-80 overflow-y-auto font-mono text-xs text-emerald-300 leading-relaxed shadow-inner">
              <pre>{sqlMigrationCode}</pre>
            </div>
          </div>
        )}

        {/* Tab 3: Tables & Sync Status */}
        {activeTab === 'tables' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Tabela Companies
                  </span>
                  <div className="text-2xl font-black text-white mt-1">
                    {companies.length} <span className="text-xs font-normal text-slate-400">registros</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tabela Mapeada
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Tabela Boletos
                  </span>
                  <div className="text-2xl font-black text-white mt-1">
                    {boletos.length} <span className="text-xs font-normal text-slate-400">títulos</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tabela Mapeada
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Tabela CNAB History
                  </span>
                  <div className="text-2xl font-black text-white mt-1">
                    {history.length} <span className="text-xs font-normal text-slate-400">remessas</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Tabela Mapeada
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    Enviar Dados Locais para o Supabase (Push)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Sincroniza todas as {companies.length} empresas, {boletos.length} boletos e {history.length} remessas diretamente no banco PostgreSQL.
                  </p>
                </div>

                <button
                  onClick={handlePushToSupabase}
                  disabled={isSyncing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Enviando...' : 'Enviar para Supabase'}</span>
                </button>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DownloadCloud className="w-4 h-4 text-teal-400" />
                    Baixar Dados do Supabase (Pull)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Recarrega as empresas e boletos cadastrados no banco Supabase para esta aplicação.
                  </p>
                </div>

                <button
                  onClick={handlePullFromSupabase}
                  disabled={isPulling}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`} />
                  <span>{isPulling ? 'Baixando...' : 'Carregar do Supabase'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
