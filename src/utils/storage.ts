import { BoletoItem, CompanySettings, CompanyProfile, BankAccountProfile, CNABBatchHistory, AuthUser } from '../types';
import { db, safeSetDoc, safeDeleteDoc, isFirestoreQuotaExceeded } from '../lib/firebase';
import { collection, doc } from 'firebase/firestore';
import {
  getSupabaseClient,
  syncCompanyProfilesToSupabase,
  syncBoletosToSupabase,
  syncHistoryToSupabase,
} from '../lib/supabase';
import { DEFAULT_COMPANIES, SANTANDER_PAGFOR_DATA } from '../data/defaultCompanies';

export { DEFAULT_COMPANIES, SANTANDER_PAGFOR_DATA };

/**
 * Strips or converts undefined properties recursively to ensure full Firestore compatibility.
 * Firestore crashes if any property is undefined.
 */
export function cleanFirestoreData<T>(data: T): any {
  if (data === undefined || data === null) {
    return null;
  }
  return JSON.parse(
    JSON.stringify(data, (_key, value) => (value === undefined ? '' : value))
  );
}

const STORAGE_KEYS = {
  COMPANIES_V6: 'gerador_cnab_companies_v6',
  ACTIVE_SELECTION_V6: 'gerador_cnab_active_selection_v6',
  COMPANIES_V5: 'gerador_cnab_companies_v5',
  ACTIVE_SELECTION_V5: 'gerador_cnab_active_selection_v5',
  COMPANIES_V4: 'gerador_cnab_companies_v4',
  ACTIVE_SELECTION_V4: 'gerador_cnab_active_selection_v4',
  COMPANIES_V3: 'gerador_cnab_companies_v3',
  ACTIVE_SELECTION_V3: 'gerador_cnab_active_selection_v3',
  COMPANIES_V2: 'gerador_cnab_companies_v2',
  COMPANY_LEGACY: 'gerador_cnab_company_v1',
  BOLETOS: 'gerador_cnab_boletos_v1',
  HISTORY: 'gerador_cnab_history_v1',
  USER_SESSION: 'wanfinance_user_session_v1',
};

const OLD_REAL_COMPANY_IDS = [
  'comp-viasul-matriz',
  'comp-eurovia-renault',
  'comp-intervia-kia',
  'comp-newvia-motos',
  'comp-via1-corretora',
  'comp-eurovia-nissan',
  'comp-viasul-jeep',
  'comp-granvia-ford',
  'comp-eurovia-omoda',
  'comp-via1-locadora',
  'comp-viasul-auto-byd',
  'comp-investparts',
  'comp-viasul-leap',
  'comp-projeto-part',
  'comp-eurovia-geely',
  'comp-intervia-filial',
];

export function cleanupOldRealCompanies(): void {
  try {
    // Clear old localStorage keys
    localStorage.removeItem('gerador_cnab_companies_v5');
    localStorage.removeItem('gerador_cnab_companies_v4');
    localStorage.removeItem('gerador_cnab_companies_v3');
    localStorage.removeItem('gerador_cnab_companies_v2');
    localStorage.removeItem('gerador_cnab_company_v1');
    localStorage.removeItem('gerador_cnab_active_selection_v5');
    localStorage.removeItem('gerador_cnab_active_selection_v4');
    localStorage.removeItem('gerador_cnab_active_selection_v3');

    // Remove old docs from Firestore if available
    if (!isFirestoreQuotaExceeded()) {
      OLD_REAL_COMPANY_IDS.forEach((id) => {
        safeDeleteDoc(doc(db, 'companies', id)).catch(() => {});
      });
    }
  } catch (err) {
    console.warn('[Storage] Cleanup old real companies warning:', err);
  }
}

/**
 * Deduplicate and sanitize company profiles list
 */
function sanitizeAndDeduplicateCompanies(companiesList: CompanyProfile[]): CompanyProfile[] {
  const seenIds = new Set<string>();
  const seenCnpjs = new Set<string>();
  const uniqueCompanies: CompanyProfile[] = [];

  for (const comp of companiesList) {
    if (!comp || !comp.id) continue;
    const cleanCnpj = (comp.cnpjCpf || '').replace(/\D/g, '');

    // Skip duplicate IDs or duplicate CNPJs
    if (seenIds.has(comp.id) || (cleanCnpj && seenCnpjs.has(cleanCnpj))) {
      continue;
    }

    seenIds.add(comp.id);
    if (cleanCnpj) seenCnpjs.add(cleanCnpj);

    // Deduplicate bank accounts inside this company
    const seenBankIds = new Set<string>();
    const sanitizedBancos: BankAccountProfile[] = [];

    if (Array.isArray(comp.bancos)) {
      for (const b of comp.bancos) {
        if (!b || !b.id || seenBankIds.has(b.id)) continue;
        seenBankIds.add(b.id);
        sanitizedBancos.push({
          ...b,
          apelido: b.apelido || 'Conta Bancária',
          bancoCodigo: b.bancoCodigo || '001',
          bancoNome: b.bancoNome || 'Banco',
          agencia: b.agencia || '',
          agenciaDV: b.agenciaDV || '0',
          conta: b.conta || '',
          contaDV: b.contaDV || '0',
          convenio: b.convenio || '',
          codigoTransmissao: b.codigoTransmissao || b.codigoEstacao || '',
          codigoEstacao: b.codigoEstacao || b.codigoTransmissao || '',
          nsa: typeof b.nsa === 'number' ? (b.bancoCodigo === '033' && b.nsa < 11 ? 11 : b.nsa) : (b.bancoCodigo === '033' ? 11 : 1),
          padraoCNAB: b.padraoCNAB || '240',
          layoutVersaoLote: b.layoutVersaoLote || (b.bancoCodigo === '033' ? '030' : '046'),
        });
      }
    }

    uniqueCompanies.push({
      ...comp,
      nomeFantasia: comp.nomeFantasia || comp.razaoSocial || 'Empresa',
      razaoSocial: comp.razaoSocial || comp.nomeFantasia || 'Empresa',
      cnpjCpf: comp.cnpjCpf || '',
      tipoInscricao: comp.tipoInscricao || 'CNPJ',
      logradouro: comp.logradouro || '',
      numero: comp.numero || '',
      complemento: comp.complemento || '',
      cidade: comp.cidade || '',
      uf: comp.uf || 'PE',
      cep: comp.cep || '',
      bancos: sanitizedBancos,
      activeBankId: comp.activeBankId || (sanitizedBancos[0] ? sanitizedBancos[0].id : ''),
    });
  }

  return uniqueCompanies;
}

export function loadCompanyProfiles(): CompanyProfile[] {
  try {
    // If old versions exist in localStorage, purge them completely
    if (
      localStorage.getItem(STORAGE_KEYS.COMPANIES_V5) ||
      localStorage.getItem(STORAGE_KEYS.COMPANIES_V4) ||
      localStorage.getItem(STORAGE_KEYS.COMPANIES_V3)
    ) {
      cleanupOldRealCompanies();
    }

    const data = localStorage.getItem(STORAGE_KEYS.COMPANIES_V6);
    if (data) {
      const parsed: CompanyProfile[] = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Detect if loaded companies contain old real dealership or corporate data
        const hasOldRealData = parsed.some((c) => {
          const nome = (c.razaoSocial || '').toUpperCase();
          const fantasia = (c.nomeFantasia || '').toUpperCase();
          const cleanCnpj = (c.cnpjCpf || '').replace(/\D/g, '');
          return (
            nome.includes('VIA SUL') ||
            nome.includes('EUROVIA') ||
            nome.includes('GRANVIA') ||
            nome.includes('INTERVIA') ||
            nome.includes('NEWVIA') ||
            nome.includes('INVESTPARTS') ||
            nome.includes('PROJETO PARTICIPACOES') ||
            fantasia.includes('VIA SUL') ||
            fantasia.includes('EUROVIA') ||
            cleanCnpj === '40841736000107' ||
            cleanCnpj === '02671595000132' ||
            cleanCnpj === '08315588000184' ||
            cleanCnpj === '51478180000314' ||
            cleanCnpj === '012946886000140' ||
            cleanCnpj === '043489824000180'
          );
        });

        if (!hasOldRealData) {
          const cleanParsed = sanitizeAndDeduplicateCompanies(parsed);

          // Ensure default fictional companies are present
          const currentIds = new Set(cleanParsed.map((c) => c.id));
          DEFAULT_COMPANIES.forEach((defComp) => {
            if (!currentIds.has(defComp.id)) {
              cleanParsed.push(defComp);
              currentIds.add(defComp.id);
            }
          });

          const finalCompanies = sanitizeAndDeduplicateCompanies(cleanParsed);
          localStorage.setItem(STORAGE_KEYS.COMPANIES_V6, JSON.stringify(finalCompanies));
          return finalCompanies;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load company profiles:', e);
  }

  // Fallback: strictly initialize with fictional companies
  cleanupOldRealCompanies();
  localStorage.setItem(STORAGE_KEYS.COMPANIES_V6, JSON.stringify(DEFAULT_COMPANIES));
  return DEFAULT_COMPANIES;
}

export function saveCompanyProfiles(companies: CompanyProfile[]): void {
  try {
    const cleanList = sanitizeAndDeduplicateCompanies(companies);
    localStorage.setItem(STORAGE_KEYS.COMPANIES_V6, JSON.stringify(cleanList));

    if (!isFirestoreQuotaExceeded()) {
      cleanList.forEach((c) => {
        const firestoreData = cleanFirestoreData(c);
        safeSetDoc(doc(db, 'companies', c.id), firestoreData, { merge: true });
      });
    }

    syncCompanyProfilesToSupabase(cleanList).catch((err) =>
      console.warn('[Supabase] Sync companies warning:', err)
    );
  } catch (e) {
    console.error('Failed to save company profiles:', e);
  }
}

export function resetToDefaultCompanies(): CompanyProfile[] {
  cleanupOldRealCompanies();
  saveCompanyProfiles(DEFAULT_COMPANIES);
  saveActiveSelection(DEFAULT_COMPANIES[0].id, DEFAULT_COMPANIES[0].bancos[0].id);
  return DEFAULT_COMPANIES;
}

export function loadActiveSelection(): { companyId: string; bankId: string } {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SELECTION_V6);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.companyId && parsed.bankId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load active selection:', e);
  }
  return {
    companyId: DEFAULT_COMPANIES[0].id,
    bankId: DEFAULT_COMPANIES[0].bancos[0].id,
  };
}

export function saveActiveSelection(companyId: string, bankId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SELECTION_V6, JSON.stringify({ companyId, bankId }));
  } catch (e) {
    console.error('Failed to save active selection:', e);
  }
}

/**
 * Returns a merged CompanySettings object for the active company and bank account
 */
export function getActiveCompanySettings(
  companies: CompanyProfile[],
  activeCompanyId: string,
  activeBankId?: string
): CompanySettings {
  const company = companies.find((c) => c.id === activeCompanyId) || companies[0] || DEFAULT_COMPANIES[0];
  const targetBankId = activeBankId || company.activeBankId || (company.bancos[0] ? company.bancos[0].id : '');
  const bank = (company && company.bancos)
    ? (company.bancos.find((b) => b.id === targetBankId) || company.bancos[0])
    : DEFAULT_COMPANIES[0].bancos[0];

  return {
    id: company.id,
    razaoSocial: company.razaoSocial,
    cnpjCpf: company.cnpjCpf,
    tipoInscricao: company.tipoInscricao,
    logradouro: company.logradouro,
    numero: company.numero,
    complemento: company.complemento,
    cidade: company.cidade,
    uf: company.uf,
    cep: company.cep,

    bancoCodigo: bank.bancoCodigo,
    bancoNome: bank.bancoNome,
    agencia: bank.agencia,
    agenciaDV: bank.agenciaDV,
    conta: bank.conta,
    contaDV: bank.contaDV,
    convenio: bank.convenio,
    codigoTransmissao: bank.codigoTransmissao,
    codigoEstacao: bank.codigoEstacao || bank.codigoTransmissao || '',
    nsa: bank.nsa,
    padraoCNAB: bank.padraoCNAB,
    layoutVersaoLote: bank.bancoCodigo === '033' ? '030' : bank.layoutVersaoLote,
  };
}

export const INITIAL_SAMPLE_BOLETOS: BoletoItem[] = [];

export function loadCompanySettings(): CompanySettings {
  const profiles = loadCompanyProfiles();
  const activeSel = loadActiveSelection();
  return getActiveCompanySettings(profiles, activeSel.companyId, activeSel.bankId);
}

export function saveCompanySettings(company: CompanySettings): void {
  // Legacy save wrapper: updates active bank/company
  const profiles = loadCompanyProfiles();
  const activeSel = loadActiveSelection();
  const updatedProfiles = profiles.map((p) => {
    if (p.id === activeSel.companyId) {
      return {
        ...p,
        razaoSocial: company.razaoSocial,
        cnpjCpf: company.cnpjCpf,
        tipoInscricao: company.tipoInscricao,
        logradouro: company.logradouro,
        numero: company.numero,
        complemento: company.complemento,
        cidade: company.cidade,
        uf: company.uf,
        cep: company.cep,
        bancos: p.bancos.map((b) => {
          if (b.id === activeSel.bankId) {
            return {
              ...b,
              bancoCodigo: company.bancoCodigo,
              bancoNome: company.bancoNome,
              agencia: company.agencia,
              agenciaDV: company.agenciaDV,
              conta: company.conta,
              contaDV: company.contaDV,
              convenio: company.convenio,
              codigoTransmissao: company.codigoTransmissao,
              codigoEstacao: company.codigoEstacao,
              nsa: company.nsa,
              padraoCNAB: company.padraoCNAB,
              layoutVersaoLote: company.layoutVersaoLote,
            };
          }
          return b;
        }),
      };
    }
    return p;
  });
  saveCompanyProfiles(updatedProfiles);
}

export function loadBoletos(): BoletoItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BOLETOS);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((b) => !b?.id?.startsWith('bol-sample-'));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.BOLETOS, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to load boletos:', e);
  }
  return [];
}

export function saveBoletos(boletos: BoletoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOLETOS, JSON.stringify(boletos));
    if (!isFirestoreQuotaExceeded()) {
      boletos.forEach((b) => {
        const firestoreData = cleanFirestoreData(b);
        safeSetDoc(doc(db, 'boletos', b.id), firestoreData, { merge: true });
      });
    }

    syncBoletosToSupabase(boletos).catch((err) =>
      console.warn('[Supabase] Sync boletos warning:', err)
    );
  } catch (e) {
    console.error('Failed to save boletos:', e);
  }
}

const RETENTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias em milissegundos

export function purgeExpiredHistory(history: CNABBatchHistory[]): CNABBatchHistory[] {
  if (!Array.isArray(history)) return [];
  const now = Date.now();
  const validItems: CNABBatchHistory[] = [];
  const expiredIds: string[] = [];

  for (const item of history) {
    const itemTime = item.timestamp || (item.createdDate ? new Date(item.createdDate).getTime() : now);
    const age = now - itemTime;
    if (age <= RETENTION_PERIOD_MS && age >= 0) {
      validItems.push({
        ...item,
        timestamp: itemTime,
        status: item.status || 'GERADO',
      });
    } else {
      expiredIds.push(item.id);
    }
  }

  // Excluir registros expirados do Firestore
  if (!isFirestoreQuotaExceeded()) {
    expiredIds.forEach((id) => {
      safeDeleteDoc(doc(db, 'cnab_history', id));
    });
  }

  return validItems;
}

export function loadHistory(userFilter?: { id?: string; email?: string } | string): CNABBatchHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const cleaned = purgeExpiredHistory(parsed);
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(cleaned));
        }

        if (userFilter) {
          const userId = typeof userFilter === 'string' ? userFilter : userFilter.id;
          const userEmail = typeof userFilter === 'string' ? userFilter : userFilter.email;

          return cleaned.filter((h) => {
            if (!h.userId && !h.userEmail && !h.analista) return true; // legacy item
            const matchesId = userId && h.userId === userId;
            const matchesEmail = userEmail && (h.userEmail === userEmail || h.analista === userEmail);
            return matchesId || matchesEmail;
          });
        }

        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  return [];
}

export function saveHistory(history: CNABBatchHistory[]): void {
  try {
    const cleanHistory = purgeExpiredHistory(history);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(cleanHistory));
    if (!isFirestoreQuotaExceeded()) {
      cleanHistory.forEach((h) => {
        const firestoreData = cleanFirestoreData(h);
        safeSetDoc(doc(db, 'cnab_history', h.id), firestoreData, { merge: true });
      });
    }

    syncHistoryToSupabase(cleanHistory).catch((err) =>
      console.warn('[Supabase] Sync history warning:', err)
    );
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

export function loadUserSession(): AuthUser | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load user session:', e);
  }
  return null;
}

export function saveUserSession(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
      if (!isFirestoreQuotaExceeded()) {
        const firestoreData = cleanFirestoreData(user);
        safeSetDoc(doc(db, 'users', user.id), firestoreData, { merge: true });
      }

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.from('user_sessions').upsert({
          id: user.id,
          user_id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          login_time: user.loginTime,
        }).then(({ error }) => {
          if (error) console.warn('[Supabase] Sync user session error:', error.message);
        });
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    }
  } catch (e) {
    console.error('Failed to save user session:', e);
  }
}
