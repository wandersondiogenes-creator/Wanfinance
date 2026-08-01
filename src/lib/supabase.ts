import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CompanyProfile, BoletoItem, CNABBatchHistory } from '../types';

const SUPABASE_CONFIG_KEY = 'wanfinance_supabase_credentials';

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

export function getStoredSupabaseCredentials(): SupabaseCredentials | null {
  try {
    const metaEnv = (import.meta as any).env || {};
    const envUrl = metaEnv.VITE_SUPABASE_URL;
    const envKey = metaEnv.VITE_SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
      return { url: envUrl, anonKey: envKey };
    }

    const localData = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (localData) {
      const parsed = JSON.parse(localData);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to get Supabase credentials:', e);
  }
  return null;
}

export function saveSupabaseCredentials(creds: SupabaseCredentials | null): void {
  try {
    if (creds) {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(creds));
    } else {
      localStorage.removeItem(SUPABASE_CONFIG_KEY);
    }
  } catch (e) {
    console.error('Failed to save Supabase credentials:', e);
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const creds = getStoredSupabaseCredentials();
  if (creds && creds.url && creds.anonKey) {
    try {
      supabaseInstance = createClient(creds.url, creds.anonKey);
      return supabaseInstance;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
    }
  }
  return null;
}

export function reinitSupabaseClient(): SupabaseClient | null {
  supabaseInstance = null;
  return getSupabaseClient();
}

export async function testSupabaseConnection(creds?: SupabaseCredentials): Promise<{ success: boolean; message: string }> {
  try {
    const clientToTest = creds
      ? createClient(creds.url, creds.anonKey)
      : getSupabaseClient();

    if (!clientToTest) {
      return {
        success: false,
        message: 'Nenhum parâmetro do Supabase configurado. Informe a URL e Anon Key.',
      };
    }

    const { error } = await clientToTest.from('companies').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Conectado com sucesso ao Supabase! (Nota: Execute o script de SQL Migration para criar as tabelas).',
        };
      }
      return {
        success: false,
        message: `Erro na conexão com Supabase: ${error.message}`,
      };
    }

    return {
      success: true,
      message: 'Conexão com o banco Supabase estabelecida e testada com sucesso!',
    };
  } catch (e: any) {
    return {
      success: false,
      message: `Falha ao conectar no Supabase: ${e.message || String(e)}`,
    };
  }
}

export async function fetchCompanyProfilesFromSupabase(): Promise<CompanyProfile[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('companies').select('*');
    if (error) {
      console.warn('[Supabase] Error fetching companies:', error.message);
      return null;
    }
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        nomeFantasia: row.nome_fantasia || row.razao_social || '',
        razaoSocial: row.razao_social || '',
        cnpjCpf: row.cnpj_cpf || '',
        tipoInscricao: row.tipo_inscricao || 'CNPJ',
        logradouro: row.logradouro || '',
        numero: row.numero || '',
        complemento: row.complemento || row.bairro || '',
        cidade: row.cidade || '',
        uf: row.uf || 'SP',
        cep: row.cep || '',
        bancos: Array.isArray(row.bancos) ? row.bancos : [],
        activeBankId: Array.isArray(row.bancos) && row.bancos.length > 0 ? row.bancos[0].id : '',
      }));
    }
  } catch (e) {
    console.error('[Supabase] Exception fetching companies:', e);
  }
  return null;
}

export async function fetchBoletosFromSupabase(): Promise<BoletoItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('boletos').select('*');
    if (error) {
      console.warn('[Supabase] Error fetching boletos:', error.message);
      return null;
    }
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        linhaDigitavel: row.linha_digitavel || '',
        codigoBarras: row.codigo_barras || '',
        favorecidoNome: row.favorecido_nome || '',
        favorecidoCnpjCpf: row.favorecido_cnpj_cpf || '',
        valor: typeof row.valor === 'number' ? row.valor : parseFloat(row.valor || '0'),
        dataVencimento: row.data_vencimento || '',
        dataPagamento: row.data_pagamento || row.data_vencimento || '',
        seuNumero: row.seu_numero || '',
        nossoNumero: row.nosso_numero || '',
        bancoCodigo: row.banco_codigo || '001',
        bancoNome: row.banco_nome || '',
        selected: row.selected !== undefined ? row.selected : true,
        categoria: row.categoria || 'Geral',
        observacoes: row.observacoes || '',
        desconto: typeof row.desconto === 'number' ? row.desconto : parseFloat(row.desconto || '0'),
        jurosMulta: typeof row.juros_multa === 'number' ? row.juros_multa : parseFloat(row.juros_multa || '0'),
        isValid: true,
        createdAt: row.created_at || new Date().toISOString(),
      }));
    }
  } catch (e) {
    console.error('[Supabase] Exception fetching boletos:', e);
  }
  return null;
}

export async function fetchHistoryFromSupabase(): Promise<CNABBatchHistory[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('cnab_history').select('*');
    if (error) {
      console.warn('[Supabase] Error fetching history:', error.message);
      return null;
    }
    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        nsa: row.nsa,
        createdDate: row.data_geracao || new Date().toISOString(),
        bancoCodigo: row.banco_codigo || '001',
        padraoCNAB: row.layout || '240',
        totalBoletos: row.total_boletos || 0,
        totalValor: typeof row.total_valor === 'number' ? row.total_valor : parseFloat(row.total_valor || '0'),
        filename: row.nome_arquivo || '',
        content: row.conteudo_cnab || '',
        boletos: Array.isArray(row.boletos_json) ? row.boletos_json : [],
      }));
    }
  } catch (e) {
    console.error('[Supabase] Exception fetching history:', e);
  }
  return null;
}

export async function syncCompanyProfilesToSupabase(
  companies: CompanyProfile[]
): Promise<{ success: boolean; error?: string; count: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client não configurado', count: 0 };
  try {
    const fullRecords = companies.map((c) => ({
      id: c.id,
      razao_social: c.razaoSocial,
      nome_fantasia: c.nomeFantasia,
      cnpj_cpf: c.cnpjCpf,
      tipo_inscricao: c.tipoInscricao || 'CNPJ',
      logradouro: c.logradouro,
      numero: c.numero,
      complemento: c.complemento || '',
      bairro: c.complemento || '',
      cidade: c.cidade,
      uf: c.uf,
      cep: c.cep,
      bancos: c.bancos,
      updated_at: new Date().toISOString(),
    }));

    let { error } = await supabase.from('companies').upsert(fullRecords);
    
    // If table is missing extended columns in schema cache, try minimal core payload
    if (error && (error.message?.includes('schema cache') || error.message?.includes('column') || error.message?.includes('JWT'))) {
      console.warn('[Supabase] Retrying companies upsert with core columns due to schema error:', error.message);
      const coreRecords = companies.map((c) => ({
        id: c.id,
        razao_social: c.razaoSocial,
        nome_fantasia: c.nomeFantasia,
        cnpj_cpf: c.cnpjCpf,
        logradouro: c.logradouro,
        numero: c.numero,
        bairro: c.complemento || '',
        cidade: c.cidade,
        uf: c.uf,
        cep: c.cep,
        bancos: c.bancos,
      }));
      const retry = await supabase.from('companies').upsert(coreRecords);
      error = retry.error;
    }

    if (error) {
      console.warn('[Supabase] Sync companies notice:', error.message);
      return { success: false, error: error.message, count: 0 };
    }
    return { success: true, count: fullRecords.length };
  } catch (e: any) {
    console.warn('[Supabase] Sync companies exception:', e);
    return { success: false, error: e.message || String(e), count: 0 };
  }
}

export async function syncBoletosToSupabase(
  boletos: BoletoItem[]
): Promise<{ success: boolean; error?: string; count: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client não configurado', count: 0 };
  try {
    const fullRecords = boletos.map((b) => ({
      id: b.id,
      codigo_barras: b.codigoBarras,
      linha_digitavel: b.linhaDigitavel,
      favorecido_nome: b.favorecidoNome,
      favorecido_cnpj_cpf: b.favorecidoCnpjCpf,
      valor: b.valor,
      data_vencimento: b.dataVencimento || null,
      data_pagamento: b.dataPagamento || null,
      seu_numero: b.seuNumero || '',
      nosso_numero: b.nossoNumero || '',
      banco_codigo: b.bancoCodigo || '001',
      banco_nome: b.bancoNome || '',
      selected: b.selected ?? true,
      categoria: b.categoria || 'Geral',
      observacoes: b.observacoes || '',
      desconto: b.desconto || 0,
      juros_multa: b.jurosMulta || 0,
    }));

    let { error } = await supabase.from('boletos').upsert(fullRecords);

    // If table is missing extended columns in schema cache, try minimal core payload
    if (error && (error.message?.includes('schema cache') || error.message?.includes('column') || error.message?.includes('JWT'))) {
      console.warn('[Supabase] Retrying boletos upsert with core columns due to schema error:', error.message);
      const coreRecords = boletos.map((b) => ({
        id: b.id,
        codigo_barras: b.codigoBarras,
        linha_digitavel: b.linhaDigitavel,
        favorecido_nome: b.favorecidoNome,
        favorecido_cnpj_cpf: b.favorecidoCnpjCpf,
        valor: b.valor,
        data_vencimento: b.dataVencimento || null,
        data_pagamento: b.dataPagamento || null,
        seu_numero: b.seuNumero || '',
        nosso_numero: b.nossoNumero || '',
        banco_codigo: b.bancoCodigo || '001',
        selected: b.selected ?? true,
      }));
      const retry = await supabase.from('boletos').upsert(coreRecords);
      error = retry.error;
    }

    if (error) {
      console.warn('[Supabase] Sync boletos notice:', error.message);
      return { success: false, error: error.message, count: 0 };
    }
    return { success: true, count: fullRecords.length };
  } catch (e: any) {
    console.warn('[Supabase] Sync boletos exception:', e);
    return { success: false, error: e.message || String(e), count: 0 };
  }
}

export async function syncHistoryToSupabase(
  history: CNABBatchHistory[]
): Promise<{ success: boolean; error?: string; count: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client não configurado', count: 0 };
  try {
    const records = history.map((h) => ({
      id: h.id,
      nsa: h.nsa,
      data_geracao: h.createdDate || new Date().toISOString(),
      empresa_nome: 'Wanfinance',
      banco_nome: h.bancoCodigo,
      banco_codigo: h.bancoCodigo,
      layout: h.padraoCNAB,
      total_boletos: h.totalBoletos,
      total_valor: h.totalValor,
      nome_arquivo: h.filename,
      conteudo_cnab: h.content,
      boletos_json: h.boletos,
    }));

    const { error } = await supabase.from('cnab_history').upsert(records);
    if (error) {
      console.error('[Supabase] Sync history failed:', error.message);
      return { success: false, error: error.message, count: 0 };
    }
    return { success: true, count: records.length };
  } catch (e: any) {
    console.error('[Supabase] Sync history exception:', e);
    return { success: false, error: e.message || String(e), count: 0 };
  }
}

