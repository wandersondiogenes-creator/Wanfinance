import * as XLSX from 'xlsx';
import { CompanyProfile, BankAccountProfile } from '../types';
import { BRAZILIAN_BANKS, getBankInfo } from './banks';

export interface ImportStats {
  totalCompanies: number;
  totalBanks: number;
  sheetNames: string[];
  newCompaniesCount: number;
  updatedCompaniesCount: number;
  warnings: string[];
}

export interface CompanyImportResult {
  success: boolean;
  error?: string;
  companies: CompanyProfile[];
  stats: ImportStats;
}

/**
 * Remove accents and punctuation, return clean lowercase string for key matching
 */
function normalizeKey(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Clean digits only
 */
function cleanDigits(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\D/g, '');
}

/**
 * Format CNPJ cleanly
 */
function formatCNPJ(cnpj: string): string {
  const clean = cleanDigits(cnpj);
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return cnpj || '';
}

/**
 * Identify Bank Code from text or number
 */
function detectBankCode(bancoField: any, codBancoField: any): { code: string; name: string } {
  const directCod = cleanDigits(codBancoField).padStart(3, '0');
  if (directCod && directCod !== '000' && directCod.length === 3) {
    const info = getBankInfo(directCod);
    return { code: directCod, name: info.name };
  }

  const bancoStr = String(bancoField || '').trim();
  const matchBrackets = bancoStr.match(/\[(\d{3})\]/);
  if (matchBrackets) {
    const code = matchBrackets[1];
    const info = getBankInfo(code);
    return { code, name: info.name };
  }

  const matchLeading = bancoStr.match(/^(\d{3})/);
  if (matchLeading) {
    const code = matchLeading[1];
    const info = getBankInfo(code);
    return { code, name: info.name };
  }

  const lower = bancoStr.toLowerCase();
  if (lower.includes('santander')) return { code: '033', name: 'Banco Santander Brasil S.A.' };
  if (lower.includes('brasil') || lower.includes('bb')) return { code: '001', name: 'Banco do Brasil S.A.' };
  if (lower.includes('itau') || lower.includes('itaú')) return { code: '341', name: 'Itaú Unibanco S.A.' };
  if (lower.includes('bradesco')) return { code: '237', name: 'Banco Bradesco S.A.' };
  if (lower.includes('caixa')) return { code: '104', name: 'Caixa Econômica Federal' };
  if (lower.includes('sicoob')) return { code: '756', name: 'Banco Cooperativo Sicoob S.A.' };
  if (lower.includes('sicredi')) return { code: '748', name: 'Banco Cooperativo Sicredi S.A.' };
  if (lower.includes('inter')) return { code: '077', name: 'Banco Inter S.A.' };
  if (lower.includes('nubank')) return { code: '260', name: 'Nu Pagamentos S.A.' };
  if (lower.includes('c6')) return { code: '336', name: 'Banco C6 S.A.' };

  return { code: '033', name: bancoStr || 'Banco Santander Brasil S.A.' };
}

/**
 * Maps a single row object from XLSX sheet into structured fields
 */
function mapRowFields(row: Record<string, any>) {
  const mapped: Record<string, any> = {};

  for (const [key, rawVal] of Object.entries(row)) {
    if (rawVal === undefined || rawVal === null) continue;
    const val = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal).trim();
    if (!val) continue;

    const norm = normalizeKey(key);

    // Razao Social
    if (
      norm.includes('razaosocial') ||
      norm === 'empresa' ||
      norm === 'nomedaempresa' ||
      norm === 'empresavinculada' ||
      norm === 'nomeempresa' ||
      norm === 'nomeunidadesantander'
    ) {
      if (!mapped.razaoSocial) mapped.razaoSocial = val;
    }

    // Nome Fantasia
    if (norm.includes('fantasia') || norm === 'apelido' || norm === 'unidade' || norm === 'filial') {
      if (!mapped.nomeFantasia) mapped.nomeFantasia = val;
    }

    // CNPJ / CPF
    if (
      norm.includes('cnpj') ||
      norm.includes('cpf') ||
      norm === 'documento' ||
      norm === 'inscricao' ||
      norm === 'cnpjempresa'
    ) {
      const digits = cleanDigits(val);
      if (digits.length >= 11 && digits.length <= 14) {
        mapped.cnpjCpf = formatCNPJ(digits);
        mapped.tipoInscricao = digits.length > 11 ? 'CNPJ' : 'CPF';
      } else if (!mapped.cnpjCpf && val) {
        mapped.cnpjCpf = val;
      }
    }

    // Cidade / UF
    if (norm === 'cidade' || norm === 'municipio') {
      mapped.cidade = val;
    }
    if (norm === 'uf' || norm === 'estado') {
      mapped.uf = val.toUpperCase().substring(0, 2);
    }
    if (norm === 'cidadeuf') {
      const parts = val.split(/[\/\-]/).map((p) => p.trim());
      if (parts[0]) mapped.cidade = parts[0];
      if (parts[1]) mapped.uf = parts[1].toUpperCase().substring(0, 2);
    }

    // Endereço
    if (norm === 'logradouro' || norm === 'endereco' || norm === 'rua') {
      mapped.logradouro = val;
    }
    if (norm === 'numero' || norm === 'num') {
      mapped.numero = val;
    }
    if (norm === 'complemento' || norm === 'compl') {
      mapped.complemento = val;
    }
    if (norm === 'cep') {
      mapped.cep = val;
    }

    // Banco
    if (norm === 'banco' || norm === 'nomebanco' || norm === 'instituicao') {
      mapped.bancoNome = val;
    }
    if (norm === 'codigobanco' || norm === 'codbanco' || norm === 'numbanco') {
      mapped.bancoCodigo = cleanDigits(val);
    }

    // Apelido da Conta
    if (norm.includes('apelidodaconta') || norm.includes('apelidoconta')) {
      mapped.apelidoConta = val;
    }

    // Agência
    if (norm === 'agencia' || norm === 'ag' || norm === 'prefixoagencia') {
      mapped.agencia = cleanDigits(val);
    }
    if (norm === 'dvagencia' || norm === 'dvag' || norm === 'digitoagencia' || norm === 'digitoag') {
      mapped.agenciaDV = val.toString().trim();
    }

    // Conta
    if (norm === 'conta' || norm === 'contacorrente' || norm === 'cta' || norm === 'numeroconta') {
      mapped.conta = cleanDigits(val);
    }
    if (norm === 'dvconta' || norm === 'dvcta' || norm === 'digitoconta' || norm === 'dv') {
      mapped.contaDV = val.toString().trim();
    }

    // Convênio
    if (
      norm.includes('convenio') ||
      norm === 'codconvenio' ||
      norm === 'codigoempresa' ||
      norm === 'contrato' ||
      norm.includes('codigodeconvenio')
    ) {
      if (val !== '(Em branco)' && val !== 'Em branco') {
        mapped.convenio = val;
      }
    }

    // Estação / Transmissão
    if (
      norm.includes('estacao') ||
      norm.includes('codigodeestacao') ||
      norm.includes('estacaosantander') ||
      norm.includes('estacaopagfor')
    ) {
      if (val !== '(Em branco)' && val !== 'Em branco') {
        mapped.codigoEstacao = val.toUpperCase().trim();
      }
    }

    if (norm.includes('transmissao') || norm.includes('codtransmissao')) {
      if (val !== '(Em branco)' && val !== 'Em branco') {
        mapped.codigoTransmissao = val;
      }
    }

    // CNAB e Layout
    if (norm.includes('padraocnab') || norm === 'cnab') {
      mapped.padraoCNAB = val.includes('400') ? '400' : '240';
    }
    if (norm.includes('versaolayoutlote') || norm.includes('versaolote')) {
      mapped.layoutVersaoLote = val;
    }
    if (norm === 'nsa' || norm.includes('proximonsa')) {
      const parsedNsa = parseInt(cleanDigits(val), 10);
      if (!isNaN(parsedNsa) && parsedNsa > 0) {
        mapped.nsa = parsedNsa;
      }
    }
  }

  return mapped;
}

/**
 * Main parser: Parses an ArrayBuffer, Uint8Array or binary string from an Excel or CSV file
 */
export function parseCompaniesWorkbook(data: ArrayBuffer | Uint8Array | string): CompanyImportResult {
  try {
    const workbook = XLSX.read(data, {
      type: typeof data === 'string' ? 'binary' : 'array',
      cellDates: false,
    });

    const sheetNames = workbook.SheetNames;
    if (!sheetNames || sheetNames.length === 0) {
      return {
        success: false,
        error: 'A planilha enviada não contém nenhuma aba legível.',
        companies: [],
        stats: { totalCompanies: 0, totalBanks: 0, sheetNames: [], newCompaniesCount: 0, updatedCompaniesCount: 0, warnings: [] },
      };
    }

    const warnings: string[] = [];
    // Map of CNPJ -> CompanyProfile
    const companiesByCnpj: Map<string, CompanyProfile> = new Map();
    // In case no CNPJ is found, fallback by Razao Social
    const companiesByName: Map<string, CompanyProfile> = new Map();

    // Priority sheet order: "Cadastro Empresas Pagadoras", "Consolidado Contas", "Cadastro Contas Bancarias", "Santander Pagfor", then others
    const sortedSheetNames = [...sheetNames].sort((a, b) => {
      const aLow = a.toLowerCase();
      const bLow = b.toLowerCase();
      if (aLow.includes('empresa')) return -1;
      if (bLow.includes('empresa')) return 1;
      if (aLow.includes('consolidado')) return -1;
      if (bLow.includes('consolidado')) return 1;
      return 0;
    });

    for (const sheetName of sortedSheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rawRows || rawRows.length === 0) continue;

      for (const rawRow of rawRows) {
        const m = mapRowFields(rawRow);

        const cleanCnpj = cleanDigits(m.cnpjCpf);
        const razao = m.razaoSocial || m.nomeFantasia || '';

        // If row has neither CNPJ nor company name, skip it
        if (!cleanCnpj && !razao) continue;

        // Key to identify company
        const key = cleanCnpj ? cleanCnpj : normalizeKey(razao);

        let company: CompanyProfile;
        if (cleanCnpj && companiesByCnpj.has(cleanCnpj)) {
          company = companiesByCnpj.get(cleanCnpj)!;
        } else if (companiesByName.has(normalizeKey(razao))) {
          company = companiesByName.get(normalizeKey(razao))!;
        } else {
          // Create new company
          const newId = `comp-imp-${cleanCnpj || Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          company = {
            id: newId,
            razaoSocial: razao || `Empresa ${cleanCnpj}`,
            nomeFantasia: m.nomeFantasia || razao || `Empresa ${cleanCnpj}`,
            cnpjCpf: m.cnpjCpf || formatCNPJ(cleanCnpj),
            tipoInscricao: m.tipoInscricao || (cleanCnpj.length <= 11 ? 'CPF' : 'CNPJ'),
            cidade: m.cidade || 'São Paulo',
            uf: m.uf || 'SP',
            logradouro: m.logradouro || '',
            numero: m.numero || '',
            complemento: m.complemento || '',
            cep: m.cep || '',
            bancos: [],
          };
          if (cleanCnpj) companiesByCnpj.set(cleanCnpj, company);
          companiesByName.set(normalizeKey(razao), company);
        }

        // Update company metadata if newer/better fields are found
        if (m.razaoSocial && (!company.razaoSocial || company.razaoSocial.startsWith('Empresa '))) {
          company.razaoSocial = m.razaoSocial;
        }
        if (m.nomeFantasia && (!company.nomeFantasia || company.nomeFantasia.startsWith('Empresa '))) {
          company.nomeFantasia = m.nomeFantasia;
        }
        if (m.cidade) company.cidade = m.cidade;
        if (m.uf) company.uf = m.uf;
        if (m.logradouro) company.logradouro = m.logradouro;
        if (m.numero) company.numero = m.numero;
        if (m.complemento) company.complemento = m.complemento;
        if (m.cep) company.cep = m.cep;

        // Check if bank account info is present on this row
        const hasBankInfo = m.agencia || m.conta || m.convenio || m.bancoNome || m.bancoCodigo || m.codigoEstacao;
        if (hasBankInfo) {
          const { code: bankCode, name: bankName } = detectBankCode(m.bancoNome, m.bancoCodigo);
          const isSantander = bankCode === '033';

          // Check if this bank account already exists in company.bancos
          const existingBankIdx = company.bancos.findIndex((b) => {
            const sameBanco = b.bancoCodigo === bankCode;
            const sameConta = cleanDigits(b.conta) === cleanDigits(m.conta);
            const sameAgencia = cleanDigits(b.agencia) === cleanDigits(m.agencia);
            return sameBanco && (sameConta || (!m.conta && sameAgencia));
          });

          if (existingBankIdx >= 0) {
            // Update existing bank account with new fields (e.g. convenio, estacao)
            const target = company.bancos[existingBankIdx];
            if (m.convenio) target.convenio = m.convenio;
            if (m.codigoEstacao) target.codigoEstacao = m.codigoEstacao;
            if (m.codigoTransmissao) target.codigoTransmissao = m.codigoTransmissao;
            if (m.agencia) target.agencia = m.agencia;
            if (m.agenciaDV) target.agenciaDV = m.agenciaDV;
            if (m.conta) target.conta = m.conta;
            if (m.contaDV) target.contaDV = m.contaDV;
            if (m.apelidoConta) target.apelido = m.apelidoConta;
            if (m.nsa) target.nsa = m.nsa;
            if (m.padraoCNAB) target.padraoCNAB = m.padraoCNAB;
            if (m.layoutVersaoLote) target.layoutVersaoLote = m.layoutVersaoLote;
          } else {
            // Add new bank account to company
            const bankId = `bank-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const apelidoDefault = `${getBankInfo(bankCode).shortName} - Ag. ${m.agencia || '0001'} C/C ${m.conta || '00000'}`;

            const newBank: BankAccountProfile = {
              id: bankId,
              apelido: m.apelidoConta || apelidoDefault,
              bancoCodigo: bankCode,
              bancoNome: bankName,
              agencia: m.agencia || '0001',
              agenciaDV: m.agenciaDV || '0',
              conta: m.conta || '00000',
              contaDV: m.contaDV || '0',
              convenio: m.convenio || '',
              codigoEstacao: isSantander ? (m.codigoEstacao || m.codigoTransmissao || '') : '',
              codigoTransmissao: m.codigoTransmissao || (!isSantander ? (m.codigoEstacao || m.convenio || '') : ''),
              nsa: m.nsa || (isSantander ? 11 : 1),
              padraoCNAB: m.padraoCNAB || '240',
              layoutVersaoLote: m.layoutVersaoLote || (isSantander ? '030' : '046'),
            };

            company.bancos.push(newBank);
            if (!company.activeBankId) {
              company.activeBankId = bankId;
            }
          }
        }
      }
    }

    // Collect all companies
    const allCompanies = Array.from(new Set([...companiesByCnpj.values(), ...companiesByName.values()]));

    // If any company has no bank accounts, add a default placeholder
    for (const comp of allCompanies) {
      if (comp.bancos.length === 0) {
        const bankId = `bank-def-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        comp.bancos.push({
          id: bankId,
          apelido: 'Santander - Conta Principal',
          bancoCodigo: '033',
          bancoNome: 'Banco Santander Brasil S.A.',
          agencia: '0001',
          agenciaDV: '0',
          conta: '00000',
          contaDV: '0',
          convenio: '',
          codigoEstacao: '',
          nsa: 11,
          padraoCNAB: '240',
          layoutVersaoLote: '030',
        });
        comp.activeBankId = bankId;
        warnings.push(`Empresa "${comp.razaoSocial}" não possuía conta especificada. Foi criada uma conta padrão.`);
      } else if (!comp.activeBankId) {
        comp.activeBankId = comp.bancos[0].id;
      }
    }

    if (allCompanies.length === 0) {
      return {
        success: false,
        error: 'Nenhuma empresa ou conta bancária pôde ser identificada na planilha. Verifique se há cabeçalhos com "CNPJ", "Razão Social" ou "Banco".',
        companies: [],
        stats: { totalCompanies: 0, totalBanks: 0, sheetNames, newCompaniesCount: 0, updatedCompaniesCount: 0, warnings },
      };
    }

    const totalBanks = allCompanies.reduce((acc, c) => acc + c.bancos.length, 0);

    return {
      success: true,
      companies: allCompanies,
      stats: {
        totalCompanies: allCompanies.length,
        totalBanks,
        sheetNames,
        newCompaniesCount: allCompanies.length,
        updatedCompaniesCount: 0,
        warnings,
      },
    };
  } catch (err: any) {
    console.error('Error parsing companies excel:', err);
    return {
      success: false,
      error: `Falha ao ler arquivo: ${err?.message || 'Arquivo corrompido ou formato não suportado.'}`,
      companies: [],
      stats: { totalCompanies: 0, totalBanks: 0, sheetNames: [], newCompaniesCount: 0, updatedCompaniesCount: 0, warnings: [] },
    };
  }
}

/**
 * Merge imported companies with current companies
 */
export function mergeCompaniesWithExisting(
  existingCompanies: CompanyProfile[],
  importedCompanies: CompanyProfile[]
): {
  merged: CompanyProfile[];
  updatedCount: number;
  newCount: number;
} {
  const result: CompanyProfile[] = [...existingCompanies];
  let updatedCount = 0;
  let newCount = 0;

  for (const imp of importedCompanies) {
    const impCnpjClean = cleanDigits(imp.cnpjCpf);
    const existingIndex = result.findIndex((curr) => {
      const currCnpjClean = cleanDigits(curr.cnpjCpf);
      return (currCnpjClean && currCnpjClean === impCnpjClean) ||
        normalizeKey(curr.razaoSocial) === normalizeKey(imp.razaoSocial);
    });

    if (existingIndex >= 0) {
      // Merge into existing company
      const existing = result[existingIndex];
      updatedCount++;

      // Update fields if imported has values
      if (imp.nomeFantasia) existing.nomeFantasia = imp.nomeFantasia;
      if (imp.razaoSocial) existing.razaoSocial = imp.razaoSocial;
      if (imp.cidade) existing.cidade = imp.cidade;
      if (imp.uf) existing.uf = imp.uf;
      if (imp.logradouro) existing.logradouro = imp.logradouro;
      if (imp.numero) existing.numero = imp.numero;
      if (imp.complemento) existing.complemento = imp.complemento;
      if (imp.cep) existing.cep = imp.cep;

      // Merge banks
      for (const impBank of imp.bancos) {
        const bankMatchIdx = existing.bancos.findIndex((b) => {
          return b.bancoCodigo === impBank.bancoCodigo &&
            cleanDigits(b.conta) === cleanDigits(impBank.conta);
        });

        if (bankMatchIdx >= 0) {
          // Update bank details
          const b = existing.bancos[bankMatchIdx];
          if (impBank.convenio) b.convenio = impBank.convenio;
          if (impBank.codigoEstacao) b.codigoEstacao = impBank.codigoEstacao;
          if (impBank.codigoTransmissao) b.codigoTransmissao = impBank.codigoTransmissao;
          if (impBank.agencia) b.agencia = impBank.agencia;
          if (impBank.agenciaDV) b.agenciaDV = impBank.agenciaDV;
          if (impBank.contaDV) b.contaDV = impBank.contaDV;
          if (impBank.apelido) b.apelido = impBank.apelido;
        } else {
          // Add new bank account
          existing.bancos.push(impBank);
        }
      }
    } else {
      // Completely new company
      result.push(imp);
      newCount++;
    }
  }

  return {
    merged: result,
    updatedCount,
    newCount,
  };
}
