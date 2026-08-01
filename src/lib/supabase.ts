import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
          message: 'Conectado com sucesso ao Supabase! (Nota: Execute a migration SQL para criar as tabelas).',
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
