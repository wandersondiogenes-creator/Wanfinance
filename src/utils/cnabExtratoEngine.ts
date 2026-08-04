import {
  ExtratoTransaction,
  LearnedCNABExtratoLayout,
  CNABExtratoFieldSpec,
  MovementCodeDefinition,
  ExtratoConversionRecord,
  CompanySettings,
} from '../types';
import { getBankInfo } from './banks';

const STORAGE_KEY_EXTRATO_LAYOUTS = 'cnab_learned_extrato_layouts_v1';
const STORAGE_KEY_EXTRATO_HISTORY = 'cnab_extrato_conversion_history_v1';

/**
 * Tabela Padrão Febraban de Códigos e Categorias de Movimentação de Extrato
 */
export class MOVEMENT_CODES_DATABASE {
  static DEFAULT_CODES: MovementCodeDefinition[] = [
    { codigo: '101', descricao: 'PIX Recebido (Crédito)', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '102', descricao: 'PIX Enviado (Débito)', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '103', descricao: 'TED Recebida', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '104', descricao: 'TED Enviada', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '105', descricao: 'DOC Recebido', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '106', descricao: 'DOC Enviado', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '201', descricao: 'Tarifa de Manutenção de Conta', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '202', descricao: 'Tarifa de Pacote de Serviços', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '203', descricao: 'Tarifa de Processamento de Boleto', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '204', descricao: 'Tarifa de Transferência/PIX', grupo: 'TARIFA', padraoBanco: 'TODOS' },
    { codigo: '301', descricao: 'Juros Sobre Saldo Devedor / Cheque Especial', grupo: 'IMPOSTO', padraoBanco: 'TODOS' },
    { codigo: '302', descricao: 'IOF - Imposto Sobre Operações Financeiras', grupo: 'IMPOSTO', padraoBanco: 'TODOS' },
    { codigo: '303', descricao: 'Imposto do Pagamento (IRRF/CSLL/PIS/COFINS)', grupo: 'IMPOSTO', padraoBanco: 'TODOS' },
    { codigo: '401', descricao: 'Aplicação Financeira (Débito p/ Investimento)', grupo: 'INVESTIMENTO', padraoBanco: 'TODOS' },
    { codigo: '402', descricao: 'Resgate de Aplicação (Crédito do Investimento)', grupo: 'INVESTIMENTO', padraoBanco: 'TODOS' },
    { codigo: '403', descricao: 'Rendimento de Aplicação Automática', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '501', descricao: 'Estorno de Lançamento em Duplicidade', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '502', descricao: 'Devolução de Pagamento / Tarifas', grupo: 'CREDITO', padraoBanco: 'TODOS' },
    { codigo: '601', descricao: 'Pagamento de Salários / Folha', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '602', descricao: 'Pagamento de Fornecedores / Boletos', grupo: 'DEBITO', padraoBanco: 'TODOS' },
    { codigo: '603', descricao: 'Pagamento de Guias de Impostos (DARF/GPS/DAS)', grupo: 'DEBITO', padraoBanco: 'TODOS' },
  ];

  static identifyCodeFromHistory(historico: string, tipo: 'C' | 'D'): { codigo: string; categoria: string } {
    const text = historico.toUpperCase();

    if (text.includes('PIX')) {
      return tipo === 'C'
        ? { codigo: '101', categoria: 'PIX Recebido' }
        : { codigo: '102', categoria: 'PIX Enviado' };
    }
    if (text.includes('TED')) {
      return tipo === 'C'
        ? { codigo: '103', categoria: 'TED Recebida' }
        : { codigo: '104', categoria: 'TED Enviada' };
    }
    if (text.includes('DOC')) {
      return tipo === 'C'
        ? { codigo: '105', categoria: 'DOC Recebido' }
        : { codigo: '106', categoria: 'DOC Enviado' };
    }
    if (text.includes('TARIFA') || text.includes('TAR ') || text.includes('PAC ') || text.includes('TAXA')) {
      return { codigo: '201', categoria: 'Tarifas Bancárias' };
    }
    if (text.includes('IOF')) {
      return { codigo: '302', categoria: 'IOF' };
    }
    if (text.includes('JUROS') || text.includes('MORA')) {
      return { codigo: '301', categoria: 'Juros e Encargos' };
    }
    if (text.includes('RESGATE') || text.includes('RESG ')) {
      return { codigo: '402', categoria: 'Resgate de Aplicação' };
    }
    if (text.includes('APLICACAO') || text.includes('APLIC ')) {
      return { codigo: '401', categoria: 'Aplicação Financeira' };
    }
    if (text.includes('ESTORNO') || text.includes('DEVOL')) {
      return { codigo: '501', categoria: 'Estorno/Devolução' };
    }
    if (text.includes('FOLHA') || text.includes('SALARIO')) {
      return { codigo: '601', categoria: 'Folha de Pagamento' };
    }
    if (text.includes('BOLETO') || text.includes('TITULO') || text.includes('PAGTO')) {
      return { codigo: '602', categoria: 'Pagamento Boletos' };
    }
    if (text.includes('DARF') || text.includes('GPS') || text.includes('DAS') || text.includes('IMPOSTO')) {
      return { codigo: '603', categoria: 'Pagamento de Tributos' };
    }

    return tipo === 'C'
      ? { codigo: '100', categoria: 'Outros Créditos' }
      : { codigo: '200', categoria: 'Outros Débitos' };
  }
}

/**
 * Padrão de Especificação do Segmento E (Extrato CNAB 240 FEBRABAN)
 */
export const FEBRABAN_SEGMENTO_E_FIELDS: CNABExtratoFieldSpec[] = [
  { posInicio: 1, posFim: 3, tamanho: 3, tipo: 'N', nomeCampo: 'Código do Banco', descricao: 'Código Numérico do Banco (ex: 341, 237, 001)' },
  { posInicio: 4, posFim: 7, tamanho: 4, tipo: 'N', nomeCampo: 'Lote de Serviço', descricao: 'Número do Lote (Padrão 0001)' },
  { posInicio: 8, posFim: 8, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Registro', descricao: '3 = Registro Detalhe' },
  { posInicio: 9, posFim: 13, tamanho: 5, tipo: 'N', nomeCampo: 'Nº Sequencial no Lote', descricao: 'Contador de lançamentos (1, 2, 3...)' },
  { posInicio: 14, posFim: 14, tamanho: 1, tipo: 'A', nomeCampo: 'Código de Segmento', descricao: "'E' = Extrato de Conta Corrente" },
  { posInicio: 15, posFim: 17, tamanho: 3, tipo: 'A', nomeCampo: 'Uso Exclusivo FEBRABAN', descricao: 'Espaços em branco' },
  { posInicio: 18, posFim: 18, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Inscrição Empresa', descricao: '1 = CPF, 2 = CNPJ' },
  { posInicio: 19, posFim: 32, tamanho: 14, tipo: 'N', nomeCampo: 'Número de Inscrição Empresa', descricao: 'CNPJ ou CPF da Empresa Titular' },
  { posInicio: 33, posFim: 47, tamanho: 15, tipo: 'A', nomeCampo: 'Código do Convênio no Banco', descricao: 'Código de Identificação da Conta / Convênio' },
  { posInicio: 48, posFim: 52, tamanho: 5, tipo: 'N', nomeCampo: 'Agência Mantenedora', descricao: 'Número da Agência Bancária' },
  { posInicio: 53, posFim: 53, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito da Agência', descricao: 'Dígito Verificador da Agência' },
  { posInicio: 54, posFim: 65, tamanho: 12, tipo: 'N', nomeCampo: 'Número da Conta Corrente', descricao: 'Número da Conta' },
  { posInicio: 66, posFim: 66, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito da Conta Corrente', descricao: 'Dígito Verificador da Conta' },
  { posInicio: 67, posFim: 67, tamanho: 1, tipo: 'A', nomeCampo: 'Dígito Agência / Conta', descricao: 'Dígito Verificador Conjunto' },
  { posInicio: 68, posFim: 97, tamanho: 30, tipo: 'A', nomeCampo: 'Nome da Empresa', descricao: 'Razão Social da Empresa' },
  { posInicio: 98, posFim: 103, tamanho: 6, tipo: 'A', nomeCampo: 'Reservado Banco', descricao: 'Uso do banco' },
  { posInicio: 104, posFim: 105, tamanho: 2, tipo: 'A', nomeCampo: 'Natureza do Lançamento', descricao: 'TR=Transferência, DP=Depósito, CX=Caixa, TB=Tarifa' },
  { posInicio: 106, posFim: 108, tamanho: 3, tipo: 'A', nomeCampo: 'Tipo de Complemento', descricao: 'Identificador adicional' },
  { posInicio: 109, posFim: 116, tamanho: 8, tipo: 'N', nomeCampo: 'Data do Lançamento', descricao: 'Data DDMMAAAA' },
  { posInicio: 117, posFim: 134, tamanho: 18, tipo: 'N', nomeCampo: 'Valor do Lançamento', descricao: 'Valor Numérico com 2 decimais sem pontuação' },
  { posInicio: 135, posFim: 135, tamanho: 1, tipo: 'A', nomeCampo: 'Tipo do Lançamento', descricao: "'C' = Crédito / Entrada, 'D' = Débito / Saída" },
  { posInicio: 136, posFim: 139, tamanho: 4, tipo: 'N', nomeCampo: 'Categoria do Lançamento', descricao: 'Código Numérico de Categoria do Extrato' },
  { posInicio: 140, posFim: 164, tamanho: 25, tipo: 'A', nomeCampo: 'Histórico do Lançamento', descricao: 'Descrição / Histórico impresso no extrato' },
  { posInicio: 165, posFim: 170, tamanho: 6, tipo: 'A', nomeCampo: 'Documento / NSU Ref', descricao: 'Número do documento ou NSU' },
  { posInicio: 171, posFim: 190, tamanho: 20, tipo: 'A', nomeCampo: 'Nº do Documento de Origem', descricao: 'Autenticação / Chave do Lançamento' },
  { posInicio: 191, posFim: 240, tamanho: 50, tipo: 'A', nomeCampo: 'Uso Exclusivo FEBRABAN', descricao: 'Espaços em branco para alinhamento 240' },
];

/**
 * Layouts padrão para inicializar a base aprendida (Santander, Bradesco, Banco do Brasil, Itaú, Caixa)
 */
export const DEFAULT_EXTRATO_LAYOUTS: LearnedCNABExtratoLayout[] = [
  {
    id: 'extrato-layout-santander-240',
    nomeLayout: 'Extrato Conta Corrente Banco Santander 240 FEBRABAN',
    bancoCodigo: '033',
    bancoNome: 'Banco Santander (Brasil) S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 64,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido (Santander)',
      '102': 'PIX Enviado (Santander)',
      '103': 'TED Crédito Web',
      '104': 'TED Débito Web',
      '201': 'Tarifa Pacote Conta Empresa',
      '203': 'Tarifa Liquidação Boleto',
      '301': 'Juros Cheque Empresa Santander',
      '601': 'Pagamento Fornecedores / Titulos',
      '602': 'Folha de Pagamento Santander',
    },
  },
  {
    id: 'extrato-layout-bradesco-240',
    nomeLayout: 'Extrato Empresarial Banco Bradesco 240',
    bancoCodigo: '237',
    bancoNome: 'Banco Bradesco S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 48,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido Bradesco',
      '102': 'PIX Enviado Bradesco',
      '103': 'TED Recebida STR',
      '104': 'TED Transf Net Bradesco',
      '201': 'Tarifa de Cesta de Serviços',
      '202': 'Tarifa Cobrança Bradesco',
      '302': 'IOF Operações Crédito',
      '601': 'Folha de Pagamento Bradesco',
    },
  },
  {
    id: 'extrato-layout-bb-240',
    nomeLayout: 'Extrato Conta Corrente Banco do Brasil 240',
    bancoCodigo: '001',
    bancoNome: 'Banco do Brasil S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 59,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido BB',
      '102': 'PIX Enviado BB',
      '103': 'TED Recebida BB',
      '104': 'TED Enviada BB',
      '201': 'Tarifa Manutenção Conta BB',
      '302': 'IOF Tributos Federais',
      '401': 'BB Rende Fácil Aplicação',
      '402': 'BB Rende Fácil Resgate',
      '603': 'Pagamento Guia DARF/GPS BB',
    },
  },
  {
    id: 'extrato-layout-itau-240',
    nomeLayout: 'Extrato Conta Corrente Itaú 240 FEBRABAN',
    bancoCodigo: '341',
    bancoNome: 'Banco Itaú Unibanco S.A.',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 52,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido Itaú',
      '102': 'PIX Enviado Itaú',
      '103': 'TED Recebida Itaú',
      '104': 'TED Enviada Itaú',
      '201': 'Tarifa de Pacote Itaú',
      '302': 'IOF',
      '401': 'Aplicação Itaú',
      '402': 'Resgate Itaú',
    },
  },
  {
    id: 'extrato-layout-caixa-240',
    nomeLayout: 'Extrato Conta Empresarial Caixa 240',
    bancoCodigo: '104',
    bancoNome: 'Caixa Econômica Federal',
    padraoCNAB: '240',
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 22,
    isCustomLearned: false,
    headerArquivoFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    headerLoteFields: FEBRABAN_SEGMENTO_E_FIELDS.slice(0, 6),
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: {
      '101': 'PIX Recebido Caixa',
      '102': 'PIX Enviado Caixa',
      '103': 'TED Recebida CEF',
      '104': 'TED Enviada CEF',
      '201': 'Tarifa Manutenção CEF',
      '601': 'Pagamento Salários Caixa',
    },
  },
];

/**
 * Funções de Armazenamento Local / Cache de Layouts de Extrato
 */
export function loadLearnedExtratoLayouts(): LearnedCNABExtratoLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTRATO_LAYOUTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao carregar layouts aprendidos:', e);
  }
  saveLearnedExtratoLayouts(DEFAULT_EXTRATO_LAYOUTS);
  return DEFAULT_EXTRATO_LAYOUTS;
}

export function saveLearnedExtratoLayouts(layouts: LearnedCNABExtratoLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXTRATO_LAYOUTS, JSON.stringify(layouts));
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao salvar layouts:', e);
  }
}

export function loadExtratoConversionHistory(): ExtratoConversionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTRATO_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao carregar histórico:', e);
  }
  return [];
}

export function saveExtratoConversionHistory(records: ExtratoConversionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXTRATO_HISTORY, JSON.stringify(records));
  } catch (e) {
    console.warn('[Extrato Engine] Erro ao salvar histórico:', e);
  }
}

/**
 * Formatadores Auxiliares para alinhamento estrito em CNAB 240
 */
function padText(text: string, length: number): string {
  const clean = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s\.\/\-\,\_]/g, '');
  return clean.padEnd(length, ' ').slice(0, length);
}

function padZero(value: number | string, length: number): string {
  const digits = String(value || 0).replace(/\D/g, '');
  return digits.padStart(length, '0').slice(-length);
}

function formatValueInCents(value: number, length: number = 18): string {
  const cents = Math.round(Math.abs(value) * 100);
  return String(cents).padStart(length, '0').slice(-length);
}

function formatDateDDMMAAAA(dateStr: string): string {
  if (!dateStr) return '01012026';
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length === 8 && !dateStr.includes('-')) {
    return clean; // já no formato DDMMAAAA ou AAAAMMDD
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '01012026';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * GERADOR DE ARQUIVO CNAB 240 DE EXTRATO BANCÁRIO
 * Converte lançamentos extraídos de planilha para as 240 colunas do Padrão Febraban
 */
export function generateCNABExtratoFile(
  transactions: ExtratoTransaction[],
  company: CompanySettings,
  layout: LearnedCNABExtratoLayout
): string {
  const lines: string[] = [];

  const bankCode = padZero(company.bancoCodigo || layout.bancoCodigo || '341', 3);
  const cnpjDigits = padZero(company.cnpjCpf.replace(/\D/g, ''), 14);
  const bankInfo = getBankInfo(bankCode);

  const agency = padZero(company.agencia || '0001', 5);
  const agencyDV = padText(company.agenciaDV || '0', 1);
  const account = padZero(company.conta || '000000', 12);
  const accountDV = padText(company.contaDV || '0', 1);
  const companyName = padText(company.razaoSocial || 'EMPRESA TITULAR DA CONTA', 30);
  const nsa = padZero(company.nsa || 1, 6);

  const now = new Date();
  const dateDDMMAAAA = formatDateDDMMAAAA(now.toISOString().split('T')[0]);
  const timeHHMMSS = padZero(`${now.getHours()}${now.getMinutes()}${now.getSeconds()}`, 6);

  // 1. HEADER DE ARQUIVO (240 posições)
  let headerArq = '';
  headerArq += bankCode; // 001-003: Banco
  headerArq += '0000'; // 004-007: Lote 0000
  headerArq += '0'; // 008-008: Tipo Reg 0 (Header Arq)
  headerArq += padText('', 9); // 009-017: Uso FEBRABAN
  headerArq += '2'; // 018-018: Tipo Inscrição (2 = CNPJ)
  headerArq += cnpjDigits; // 019-032: CNPJ
  headerArq += padText(company.convenio || '000000000000001', 20); // 033-052: Convênio
  headerArq += agency; // 053-057: Agência
  headerArq += agencyDV; // 058-058: DV Agência
  headerArq += account; // 059-070: Conta
  headerArq += accountDV; // 071-071: DV Conta
  headerArq += ' '; // 072-072: DV Ag/Conta
  headerArq += companyName; // 073-102: Nome Empresa
  headerArq += padText(bankInfo.shortName.toUpperCase(), 30); // 103-132: Nome Banco
  headerArq += padText('', 10); // 133-142: Uso FEBRABAN
  headerArq += '1'; // 143-143: Código Remessa/Retorno (1=Remessa/Extrato)
  headerArq += dateDDMMAAAA; // 144-151: Data Geração
  headerArq += timeHHMMSS; // 152-157: Hora Geração
  headerArq += nsa; // 158-163: Sequencial NSA
  headerArq += '080'; // 164-166: Versão Layout 080
  headerArq += '00000'; // 167-171: Densidade
  headerArq += padText('', 69); // 172-240: Reservado Banco/FEBRABAN

  lines.push(headerArq);

  // 2. HEADER DE LOTE DE EXTRATO (240 posições)
  let headerLote = '';
  headerLote += bankCode; // 001-003: Banco
  headerLote += '0001'; // 004-007: Lote 0001
  headerLote += '1'; // 008-008: Tipo Reg 1 (Header Lote)
  headerLote += 'E'; // 009-009: Operação 'E' (Extrato)
  headerLote += '04'; // 010-011: Serviço 04 (Extrato de CC)
  headerLote += '00'; // 012-013: Forma Lançamento
  headerLote += '030'; // 014-016: Versão Layout Lote
  headerLote += ' '; // 017-017: Uso FEBRABAN
  headerLote += '2'; // 018-018: CNPJ
  headerLote += cnpjDigits; // 019-032: CNPJ
  headerLote += padText(company.convenio || '000000000000001', 20); // 033-052
  headerLote += agency; // 053-057
  headerLote += agencyDV; // 058-058
  headerLote += account; // 059-070
  headerLote += accountDV; // 071-071
  headerLote += ' '; // 072-072
  headerLote += companyName; // 073-102
  headerLote += padText('', 40); // 103-142
  headerLote += dateDDMMAAAA; // 143-150: Data Inicial
  headerLote += formatValueInCents(0, 18); // 151-168: Saldo Inicial
  headerLote += 'C'; // 169-169: Situação Saldo Inicial
  headerLote += 'M'; // 170-170: Posição do Saldo (M = Matriz)
  headerLote += 'BRL'; // 171-173: Moeda
  headerLote += padZero(1, 6); // 174-179: Nº Sequencial Extrato
  headerLote += padText('', 61); // 180-240: Uso FEBRABAN

  lines.push(headerLote);

  // 3. REGISTROS DETALHE - SEGMENTO E (240 posições para cada transação do extrato)
  let totalCreditos = 0;
  let totalDebitos = 0;
  let seqInLote = 0;

  transactions.forEach((tx) => {
    seqInLote += 1;

    if (tx.tipo === 'C') totalCreditos += Math.abs(tx.valor);
    else totalDebitos += Math.abs(tx.valor);

    const txDate = formatDateDDMMAAAA(tx.dataLancamento);
    const txValCents = formatValueInCents(tx.valor, 18);
    const txTipo = tx.tipo === 'C' ? 'C' : 'D';
    const codigoMov = padZero(tx.codigoMovimento || '100', 4);
    const historicoText = padText(tx.historico || 'LANCAMENTO DE EXTRATO', 25);
    const docRef = padText(tx.documentoRef || `${seqInLote}`, 6);
    const docOrigem = padText(tx.documentoRef || `NSU-${seqInLote}`, 20);

    let segE = '';
    segE += bankCode; // 001-003
    segE += '0001'; // 004-007: Lote 0001
    segE += '3'; // 008-008: Detalhe
    segE += padZero(seqInLote, 5); // 009-013: Seq no Lote
    segE += 'E'; // 014-014: Segmento E
    segE += padText('', 3); // 015-017: Uso FEBRABAN
    segE += '2'; // 018-018: CNPJ
    segE += cnpjDigits; // 019-032: CNPJ
    segE += padText(company.convenio || '000000000000001', 15); // 033-047
    segE += agency; // 048-052
    segE += agencyDV; // 053-053
    segE += account; // 054-065
    segE += accountDV; // 066-066
    segE += ' '; // 067-067
    segE += companyName; // 068-097
    segE += padText('', 6); // 098-103
    segE += 'TR'; // 104-105: Natureza Lançamento
    segE += '000'; // 106-108: Tipo Complemento
    segE += txDate; // 109-116: Data Lançamento
    segE += txValCents; // 117-134: Valor Lançamento
    segE += txTipo; // 135-135: 'C' ou 'D'
    segE += codigoMov; // 136-139: Categoria Lançamento
    segE += historicoText; // 140-164: Histórico
    segE += docRef; // 165-170: Documento/NSU
    segE += docOrigem; // 171-190: Nº Documento Origem
    segE += padText('', 50); // 191-240: Reservado

    lines.push(segE);
  });

  // 4. TRAILER DE LOTE (240 posições)
  const totalRegLote = seqInLote + 2; // + HeaderLote + TrailerLote
  let trailerLote = '';
  trailerLote += bankCode; // 001-003
  trailerLote += '0001'; // 004-007
  trailerLote += '5'; // 008-008: Tipo Reg 5 (Trailer Lote)
  trailerLote += padText('', 9); // 009-017
  trailerLote += '2'; // 018-018: CNPJ
  trailerLote += cnpjDigits; // 019-032
  trailerLote += padText('', 15); // 033-047
  trailerLote += agency; // 048-052
  trailerLote += agencyDV; // 053-053
  trailerLote += account; // 054-065
  trailerLote += accountDV; // 066-066
  trailerLote += ' '; // 067-067
  trailerLote += formatValueInCents(totalDebitos, 18); // 068-085: Total Débitos
  trailerLote += formatValueInCents(totalCreditos, 18); // 086-103: Total Créditos
  trailerLote += formatValueInCents(totalCreditos - totalDebitos, 18); // 104-121: Saldo Final
  trailerLote += totalCreditos >= totalDebitos ? 'C' : 'D'; // 122-122: Situação Saldo Final
  trailerLote += padZero(totalRegLote, 6); // 123-128: Qtd Registros no Lote
  trailerLote += padText('', 112); // 129-240: Uso FEBRABAN

  lines.push(trailerLote);

  // 5. TRAILER DE ARQUIVO (240 posições)
  const totalRegArquivo = lines.length + 1;
  let trailerArq = '';
  trailerArq += bankCode; // 001-003
  trailerArq += '9999'; // 004-007
  trailerArq += '9'; // 008-008: Tipo Reg 9 (Trailer Arq)
  trailerArq += padText('', 9); // 009-017
  trailerArq += padZero(1, 6); // 018-023: Qtd Lotes
  trailerArq += padZero(totalRegArquivo, 6); // 024-029: Qtd Registros Arquivo
  trailerArq += padText('', 211); // 030-240: Uso FEBRABAN

  lines.push(trailerArq);

  return lines.join('\r\n');
}

/**
 * ENGENHARIA REVERSA & APRENDIZADO DE LAYOUTS CNAB DE MODELOS RECEBIDOS
 * Analisa as linhas do arquivo CNAB modelo, identifica Header, Detalhes, Trailer e posições de campos
 */
export function reverseEngineCnabStructure(
  cnabRawContent: string,
  fileName: string = 'Modelo_CNAB.ret',
  company?: CompanySettings
): LearnedCNABExtratoLayout {
  const lines = cnabRawContent
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  let detectedBankCode = '341';
  let detectedPadrao: '240' | '400' = '240';
  let detectedBankName = 'Banco Não Identificado';

  let sampleHeaderArq = '';
  let sampleHeaderLote = '';
  let sampleSegmentE = '';
  let sampleTrailerLote = '';
  let sampleTrailerArq = '';

  let detectedAgencia = '';
  let detectedConta = '';
  let detectedConvenio = '';
  let detectedEmpresaNome = company?.razaoSocial || '';

  const movementCodesDetected: Record<string, string> = {};

  if (lines.length > 0) {
    const line1 = lines[0];
    if (line1.length >= 240) {
      detectedPadrao = '240';
      detectedBankCode = line1.substring(0, 3);
      sampleHeaderArq = line1.padEnd(240, ' ').slice(0, 240);

      // Tenta extrair dados cadastrais do Header do Modelo
      detectedConvenio = line1.substring(32, 52).trim();
      detectedAgencia = line1.substring(52, 57).replace(/^0+/, '');
      detectedConta = line1.substring(58, 70).replace(/^0+/, '');
      if (!detectedEmpresaNome) {
        detectedEmpresaNome = line1.substring(72, 102).trim();
      }
    } else if (line1.length === 400) {
      detectedPadrao = '400';
      detectedBankCode = line1.substring(76, 79) || line1.substring(0, 3);
      sampleHeaderArq = line1;
    }
    const bInfo = getBankInfo(detectedBankCode);
    detectedBankName = bInfo.shortName;
  }

  // Percorre as linhas do modelo para extrair amostras e códigos de movimentação do Segmento E / Detalhe
  lines.forEach((line) => {
    if (line.length >= 240) {
      const regType = line.charAt(7);
      const segCode = line.charAt(13);

      if (regType === '1' && !sampleHeaderLote) {
        sampleHeaderLote = line.padEnd(240, ' ').slice(0, 240);
      } else if (regType === '3' && segCode === 'E') {
        if (!sampleSegmentE) {
          sampleSegmentE = line.padEnd(240, ' ').slice(0, 240);
        }
        const code = line.substring(135, 139).trim();
        const hist = line.substring(139, 164).trim();
        if (code && hist) {
          movementCodesDetected[code] = hist;
        }
      } else if (regType === '5' && !sampleTrailerLote) {
        sampleTrailerLote = line.padEnd(240, ' ').slice(0, 240);
      } else if (regType === '9' && !sampleTrailerArq) {
        sampleTrailerArq = line.padEnd(240, ' ').slice(0, 240);
      }
    }
  });

  const layoutId = `layout-custom-${detectedBankCode}-${Date.now().toString(36)}`;
  const companyLabel = company?.razaoSocial || detectedEmpresaNome || 'Empresa Geral';
  const layoutName = `Modelo CNAB ${detectedPadrao} - ${detectedBankName} (${detectedBankCode}) [${companyLabel}]`;

  const newLearnedLayout: LearnedCNABExtratoLayout = {
    id: layoutId,
    nomeLayout: layoutName,
    bancoCodigo: detectedBankCode,
    bancoNome: detectedBankName,
    padraoCNAB: detectedPadrao,
    createdDate: new Date().toISOString(),
    lastUsedDate: new Date().toISOString(),
    timesUsed: 1,
    isCustomLearned: true,

    // Vínculo com Empresa e Dados da Conta extraídos do arquivo modelo
    empresaId: company?.id || '',
    empresaNome: companyLabel,
    agenciaPadrao: company?.agencia || detectedAgencia || '0001',
    contaPadrao: company?.conta || detectedConta || '00000',
    convenioPadrao: company?.convenio || detectedConvenio || '000001',

    // Amostras das linhas originais modelo espelhadas
    sampleHeaderArq,
    sampleHeaderLote,
    sampleSegmentE,
    sampleTrailerLote,
    sampleTrailerArq,

    headerArquivoFields: [
      { posInicio: 1, posFim: 3, tamanho: 3, tipo: 'N', nomeCampo: 'Código do Banco', descricao: 'Código numérico do banco emissor' },
      { posInicio: 4, posFim: 7, tamanho: 4, tipo: 'N', nomeCampo: 'Lote de Serviço', descricao: 'Identificador do Lote (0000)' },
      { posInicio: 8, posFim: 8, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Registro', descricao: '0 = Header de Arquivo' },
      { posInicio: 19, posFim: 32, tamanho: 14, tipo: 'N', nomeCampo: 'CNPJ/CPF Empresa', descricao: 'Inscrição do titular da conta' },
      { posInicio: 73, posFim: 102, tamanho: 30, tipo: 'A', nomeCampo: 'Nome da Empresa', descricao: 'Razão social cadastrada' },
      { posInicio: 144, posFim: 151, tamanho: 8, tipo: 'N', nomeCampo: 'Data de Geração', descricao: 'Data de emissão do arquivo (DDMMAAAA)' },
    ],
    headerLoteFields: [
      { posInicio: 1, posFim: 3, tamanho: 3, tipo: 'N', nomeCampo: 'Código do Banco', descricao: 'Código do banco' },
      { posInicio: 8, posFim: 8, tamanho: 1, tipo: 'N', nomeCampo: 'Tipo de Registro', descricao: '1 = Header de Lote' },
      { posInicio: 10, posFim: 11, tamanho: 2, tipo: 'N', nomeCampo: 'Tipo de Serviço', descricao: '04 = Extrato de Conta Corrente' },
    ],
    segmentoEFields: FEBRABAN_SEGMENTO_E_FIELDS,
    trailerLoteFields: [],
    trailerArquivoFields: [],
    movementCodesMap: Object.keys(movementCodesDetected).length > 0 ? movementCodesDetected : {
      '101': 'PIX Recebido',
      '102': 'PIX Enviado',
      '103': 'TED Recebida',
      '104': 'TED Enviada',
      '201': 'Tarifa de Pacote de Serviços',
    },
  };

  // Salva o layout na base aprendida de extratos
  const currentLayouts = loadLearnedExtratoLayouts();
  currentLayouts.unshift(newLearnedLayout);
  saveLearnedExtratoLayouts(currentLayouts);

  return newLearnedLayout;
}
