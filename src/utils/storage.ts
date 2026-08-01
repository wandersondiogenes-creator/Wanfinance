import { BoletoItem, CompanySettings, CompanyProfile, BankAccountProfile, CNABBatchHistory, AuthUser } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getSupabaseClient } from '../lib/supabase';

const STORAGE_KEYS = {
  COMPANIES_V3: 'gerador_cnab_companies_v3',
  ACTIVE_SELECTION_V3: 'gerador_cnab_active_selection_v3',
  COMPANIES_V2: 'gerador_cnab_companies_v2',
  COMPANY_LEGACY: 'gerador_cnab_company_v1',
  BOLETOS: 'gerador_cnab_boletos_v1',
  HISTORY: 'gerador_cnab_history_v1',
  USER_SESSION: 'wanfinance_user_session_v1',
};

export const DEFAULT_COMPANIES: CompanyProfile[] = [
  {
    id: 'comp-byd-01',
    nomeFantasia: 'BYD',
    razaoSocial: 'BYD DO BRASIL S.A.',
    cnpjCpf: '54122933000180',
    tipoInscricao: 'CNPJ',
    logradouro: 'RUA DAS INDUSTRIAS',
    numero: '100',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '01000000',
    bancos: [
      {
        id: 'bank-byd-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '989582',
        contaDV: '0',
        convenio: '9895820',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-byd-01',
  },
  {
    id: 'comp-ford-02',
    nomeFantasia: 'FORD',
    razaoSocial: 'FORD MOTOR COMPANY BRASIL LTDA',
    cnpjCpf: '12946886000140',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA DAS NACOES UNIDAS',
    numero: '2000',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '04578000',
    bancos: [
      {
        id: 'bank-ford-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '5196',
        agenciaDV: '0',
        conta: '182090',
        contaDV: '0',
        convenio: '1820900',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-ford-01',
  },
  {
    id: 'comp-geely-03',
    nomeFantasia: 'GEELY',
    razaoSocial: 'GEELY MOTORS DO BRASIL',
    cnpjCpf: '60933323000160',
    tipoInscricao: 'CNPJ',
    logradouro: 'ALAMEDA RIO NEGRO',
    numero: '500',
    complemento: '',
    cidade: 'BARUERI',
    uf: 'SP',
    cep: '06454000',
    bancos: [
      {
        id: 'bank-geely-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '981845',
        contaDV: '0',
        convenio: '9818450',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-geely-01',
  },
  {
    id: 'comp-investparts-04',
    nomeFantasia: 'INVESTPARTS',
    razaoSocial: 'INVESTPARTS PARTICIPACOES E EMPREENDIMENTOS S.A.',
    cnpjCpf: '07191977000182',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA PAULISTA',
    numero: '1500',
    complemento: 'SALA 1001',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '01310200',
    bancos: [
      {
        id: 'bank-investparts-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '1247',
        agenciaDV: '0',
        conta: '407388',
        contaDV: '0',
        convenio: '4073880',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-investparts-01',
  },
  {
    id: 'comp-jeep-05',
    nomeFantasia: 'JEEP',
    razaoSocial: 'JEEP AUTOMOVEIS DO BRASIL LTDA',
    cnpjCpf: '40841736001006',
    tipoInscricao: 'CNPJ',
    logradouro: 'RODOVIA BR 101',
    numero: 'KM 12',
    complemento: '',
    cidade: 'GOIANA',
    uf: 'PE',
    cep: '55900000',
    bancos: [
      {
        id: 'bank-jeep-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '133140',
        contaDV: '0',
        convenio: '1331400',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-jeep-01',
  },
  {
    id: 'comp-kia-06',
    nomeFantasia: 'KIA',
    razaoSocial: 'KIA MOTORS DO BRASIL LTDA',
    cnpjCpf: '08315588000184',
    tipoInscricao: 'CNPJ',
    logradouro: 'ALAMEDA DOS ANACARDIOS',
    numero: '300',
    complemento: '',
    cidade: 'ITU',
    uf: 'SP',
    cep: '13309000',
    bancos: [
      {
        id: 'bank-kia-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '508440',
        contaDV: '0',
        convenio: '5084400',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-kia-01',
  },
  {
    id: 'comp-leap-07',
    nomeFantasia: 'LEAP',
    razaoSocial: 'LEAPMOTOR BRASIL AUTOMOVEIS',
    cnpjCpf: '40841736002312',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA BRIGADEIRO FARIA LIMA',
    numero: '3400',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '04538132',
    bancos: [
      {
        id: 'bank-leap-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '981712',
        contaDV: '0',
        convenio: '9817120',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-leap-01',
  },
  {
    id: 'comp-newvia-08',
    nomeFantasia: 'NEWVIA',
    razaoSocial: 'NEWVIA VEICULOS E PECAS LTDA',
    cnpjCpf: '51478180000152',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA CARLOS GOMES',
    numero: '700',
    complemento: '',
    cidade: 'PORTO ALEGRE',
    uf: 'RS',
    cep: '90480000',
    bancos: [
      {
        id: 'bank-newvia-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '804138',
        contaDV: '0',
        convenio: '8041380',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-newvia-01',
  },
  {
    id: 'comp-nissan-09',
    nomeFantasia: 'NISSAN',
    razaoSocial: 'NISSAN DO BRASIL AUTOMOVEIS LTDA',
    cnpjCpf: '04109834000190',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA ROCHA POMBO',
    numero: '2000',
    complemento: '',
    cidade: 'SAO JOSE DOS PINHAIS',
    uf: 'PR',
    cep: '83010900',
    bancos: [
      {
        id: 'bank-nissan-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '508481',
        contaDV: '0',
        convenio: '5084810',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-nissan-01',
  },
  {
    id: 'comp-omoda-10',
    nomeFantasia: 'OMODA',
    razaoSocial: 'OMODA & JAECOO BRASIL AUTOMOVEIS',
    cnpjCpf: '55479113000103',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA CHUCRI ZAIDAN',
    numero: '1240',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '04711130',
    bancos: [
      {
        id: 'bank-omoda-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '985655',
        contaDV: '0',
        convenio: '9856550',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-omoda-01',
  },
  {
    id: 'comp-projeto-11',
    nomeFantasia: 'PROJETO PARTICIPACOES',
    razaoSocial: 'PROJETO PARTICIPACOES E EMPREENDIMENTOS S.A.',
    cnpjCpf: '01800826000106',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA REBOUCAS',
    numero: '2500',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '05402000',
    bancos: [
      {
        id: 'bank-projeto-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '508465',
        contaDV: '0',
        convenio: '5084650',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-projeto-01',
  },
  {
    id: 'comp-renault-12',
    nomeFantasia: 'RENAULT',
    razaoSocial: 'RENAULT DO BRASIL S.A.',
    cnpjCpf: '02671595000132',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA RENAULT',
    numero: '1300',
    complemento: '',
    cidade: 'SAO JOSE DOS PINHAIS',
    uf: 'PR',
    cep: '83070900',
    bancos: [
      {
        id: 'bank-renault-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '400929',
        contaDV: '0',
        convenio: '4009290',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-renault-01',
  },
  {
    id: 'comp-viaholding-13',
    nomeFantasia: 'VIA HOLDING S.A.',
    razaoSocial: 'VIA HOLDING S.A.',
    cnpjCpf: '27537487000100',
    tipoInscricao: 'CNPJ',
    logradouro: 'RUA SAMUEL KLEIN',
    numero: '83',
    complemento: '',
    cidade: 'SAO CAETANO DO SUL',
    uf: 'SP',
    cep: '09510125',
    bancos: [
      {
        id: 'bank-viaholding-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '987222',
        contaDV: '0',
        convenio: '9872220',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-viaholding-01',
  },
  {
    id: 'comp-viasul-14',
    nomeFantasia: 'VIASUL',
    razaoSocial: 'VIASUL VEICULOS E PECAS S.A.',
    cnpjCpf: '40841736000107',
    tipoInscricao: 'CNPJ',
    logradouro: 'AVENIDA MARECHAL TITO',
    numero: '3500',
    complemento: '',
    cidade: 'SAO PAULO',
    uf: 'SP',
    cep: '08115000',
    bancos: [
      {
        id: 'bank-viasul-01',
        apelido: 'Itaú - Conta Principal',
        bancoCodigo: '341',
        bancoNome: 'Itaú Unibanco S.A.',
        agencia: '0877',
        agenciaDV: '0',
        conta: '400911',
        contaDV: '0',
        convenio: '4009110',
        codigoTransmissao: '',
        nsa: 1,
        padraoCNAB: '240',
        layoutVersaoLote: '046',
      }
    ],
    activeBankId: 'bank-viasul-01',
  }
];

export function loadCompanyProfiles(): CompanyProfile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANIES_V3);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load company profiles:', e);
  }

  saveCompanyProfiles(DEFAULT_COMPANIES);
  return DEFAULT_COMPANIES;
}

export function saveCompanyProfiles(companies: CompanyProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COMPANIES_V3, JSON.stringify(companies));
    companies.forEach((c) => {
      setDoc(doc(db, 'companies', c.id), c, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync company warning:', err)
      );
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const records = companies.map((c) => ({
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
      supabase.from('companies').upsert(records).then(({ error }) => {
        if (error) console.warn('[Supabase] Sync companies error:', error.message);
      });
    }
  } catch (e) {
    console.error('Failed to save company profiles:', e);
  }
}

export function loadActiveSelection(): { companyId: string; bankId: string } {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIVE_SELECTION_V3);
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
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SELECTION_V3, JSON.stringify({ companyId, bankId }));
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
    nsa: bank.nsa,
    padraoCNAB: bank.padraoCNAB,
    layoutVersaoLote: bank.layoutVersaoLote,
  };
}

export const INITIAL_SAMPLE_BOLETOS: BoletoItem[] = [
  {
    id: 'bol-sample-1',
    linhaDigitavel: '00190000090123456700400001234567885000000012345',
    codigoBarras: '00198850000000123450000001234567004000012345',
    bancoCodigo: '001',
    bancoNome: 'Banco do Brasil',
    favorecidoNome: 'FORNECEDOR DE SOFTWARE S.A.',
    favorecidoCnpjCpf: '98765432000188',
    valor: 123.45,
    dataVencimento: '2026-08-15',
    dataPagamento: '2026-08-15',
    seuNumero: 'NF-8942',
    desconto: 0,
    jurosMulta: 0,
    categoria: 'Licença de Software',
    observacoes: 'Mensalidade do sistema ERP',
    isValid: true,
    selected: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bol-sample-2',
    linhaDigitavel: '23790000020111122220300003333444585000000085000',
    codigoBarras: '23795850000000850000000001111222200003333444',
    bancoCodigo: '237',
    bancoNome: 'Bradesco',
    favorecidoNome: 'DISTRIBUIDORA ELETRICA LTDA',
    favorecidoCnpjCpf: '45678912000133',
    valor: 850.00,
    dataVencimento: '2026-08-10',
    dataPagamento: '2026-08-10',
    seuNumero: 'FAT-4012',
    desconto: 20.00,
    jurosMulta: 0,
    categoria: 'Energia / Insumos',
    observacoes: 'Conta de energia do galpão',
    isValid: true,
    selected: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bol-sample-3',
    linhaDigitavel: '34191234560000012345612345678901285000000150000',
    codigoBarras: '34192850000001500001234500000123456123456789',
    bancoCodigo: '341',
    bancoNome: 'Itaú',
    favorecidoNome: 'CONSULTORIA CONTABIL SILVA',
    favorecidoCnpjCpf: '11223344000155',
    valor: 1500.00,
    dataVencimento: '2026-08-20',
    dataPagamento: '2026-08-20',
    seuNumero: 'HON-082026',
    desconto: 0,
    jurosMulta: 0,
    categoria: 'Serviços Profissionais',
    observacoes: 'Honorários contábeis do mês',
    isValid: true,
    selected: true,
    createdAt: new Date().toISOString(),
  }
];

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
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load boletos:', e);
  }
  return INITIAL_SAMPLE_BOLETOS;
}

export function saveBoletos(boletos: BoletoItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.BOLETOS, JSON.stringify(boletos));
    boletos.forEach((b) => {
      setDoc(doc(db, 'boletos', b.id), b, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync boleto warning:', err)
      );
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const records = boletos.map((b) => ({
        id: b.id,
        codigo_barras: b.codigoBarras,
        linha_digitavel: b.linhaDigitavel,
        favorecido_nome: b.favorecidoNome,
        favorecido_cnpj_cpf: b.favorecidoCnpjCpf,
        valor: b.valor,
        data_vencimento: b.dataVencimento,
        data_pagamento: b.dataPagamento,
        seu_numero: b.seuNumero,
        nosso_numero: b.nossoNumero,
        banco_codigo: b.bancoCodigo,
        selected: b.selected,
      }));
      supabase.from('boletos').upsert(records).then(({ error }) => {
        if (error) console.warn('[Supabase] Sync boletos error:', error.message);
      });
    }
  } catch (e) {
    console.error('Failed to save boletos:', e);
  }
}

export function loadHistory(): CNABBatchHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  return [];
}

export function saveHistory(history: CNABBatchHistory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    history.forEach((h) => {
      setDoc(doc(db, 'cnab_history', h.id), h, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync history warning:', err)
      );
    });

    const supabase = getSupabaseClient();
    if (supabase) {
      const records = history.map((h) => ({
        id: h.id,
        nsa: h.nsa,
        data_geracao: h.createdDate,
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
      supabase.from('cnab_history').upsert(records).then(({ error }) => {
        if (error) console.warn('[Supabase] Sync history error:', error.message);
      });
    }
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
      setDoc(doc(db, 'users', user.id), user, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync user session warning:', err)
      );

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
