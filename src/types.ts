export type BoletoType = 'titulo_bancario' | 'concessionaria' | 'tributo' | 'manual';

export interface BoletoItem {
  id: string;
  linhaDigitavel: string;
  codigoBarras: string;
  bancoCodigo: string;
  bancoNome: string;
  favorecidoNome: string;
  favorecidoCnpjCpf?: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  dataPagamento: string; // YYYY-MM-DD
  seuNumero: string; // ID interno / Referência do pagamento (ex: NF 1234)
  nossoNumero?: string;
  desconto?: number;
  jurosMulta?: number;
  categoria?: string;
  observacoes?: string;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
  createdAt: string;
}

export interface BankAccountProfile {
  id: string;
  apelido: string; // ex: "Itaú - Principal", "Bradesco - Folha", "BB - Fornecedores"
  bancoCodigo: string;
  bancoNome: string;
  agencia: string;
  agenciaDV: string;
  conta: string;
  contaDV: string;
  convenio: string; // Código do convênio no banco
  codigoTransmissao?: string;
  nsa: number; // Número Sequencial do Arquivo
  padraoCNAB: '240' | '400';
  layoutVersaoLote: string; // ex: '040' ou '046' ou '081'
}

export interface CompanyProfile {
  id: string;
  nomeFantasia?: string;
  razaoSocial: string;
  cnpjCpf: string;
  tipoInscricao: 'CNPJ' | 'CPF'; // 1=CPF, 2=CNPJ
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  uf: string;
  cep: string;
  bancos: BankAccountProfile[];
  activeBankId?: string;
}

export interface CompanySettings {
  razaoSocial: string;
  cnpjCpf: string;
  tipoInscricao: 'CNPJ' | 'CPF'; // 1=CPF, 2=CNPJ
  bancoCodigo: string;
  bancoNome: string;
  agencia: string;
  agenciaDV: string;
  conta: string;
  contaDV: string;
  convenio: string; // Código do convênio no banco
  codigoTransmissao?: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  uf: string;
  cep: string;
  nsa: number; // Número Sequencial do Arquivo
  padraoCNAB: '240' | '400';
  layoutVersaoLote: string; // ex: '040' ou '046' ou '081'
}

export interface CNABLineHighlight {
  type: 'HEADER_ARQUIVO' | 'HEADER_LOTE' | 'SEGMENTO_J' | 'SEGMENTO_J52' | 'TRAILER_LOTE' | 'TRAILER_ARQUIVO' | 'HEADER_400' | 'DETALHE_400' | 'TRAILER_400';
  lineNumber: number;
  content: string;
  description: string;
  fields: {
    pos: string;
    name: string;
    value: string;
    description: string;
  }[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  loginTime: string;
}

export interface BankApiTestResult {
  httpStatus: number;
  responseTimeMs: number;
  tokenObtido?: string;
  apiMessage: string;
  rawJson: string;
  timestamp: string;
  success: boolean;
  errorReason?: string;
}

export interface BankPaymentApiConfig {
  id: string;
  bancoCodigo: string;
  bancoNome: string;
  ambiente: 'SANDBOX' | 'PRODUCTION';
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  certificadoPem: string;
  certificadoName: string;
  senhaCertificado: string;
  oauthFlow: 'CLIENT_CREDENTIALS' | 'MUTUAL_TLS_OAUTH';
  scope: string;
  convenio: string;
  conta: string;
  agencia: string;
  empresaId: string; // CNPJ ou ID da empresa no banco
  isConnectionValidated: boolean;
  lastTestResult?: BankApiTestResult;
  updatedAt?: string;
}

export interface PaymentApiTransaction {
  id: string;
  protocolo: string;
  boletoId?: string;
  bancoCodigo: string;
  bancoNome: string;
  favorecidoNome: string;
  favorecidoCnpjCpf?: string;
  valor: number;
  linhaDigitavel: string;
  dataVencimento: string;
  dataPagamento: string;
  seuNumero: string;
  nossoNumero?: string;
  status: 'ENVIADO' | 'PROCESSANDO' | 'EFETIVADO' | 'REJEITADO' | 'CANCELADO';
  mensagemRetorno?: string;
  codigoRetorno?: string;
  dataEnvio: string;
  canCancel: boolean;
  rawResponse?: string;
}

export interface BankApiLog {
  id: string;
  timestamp: string;
  bancoNome: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  httpStatus: number;
  responseTimeMs: number;
  requestPayload: string;
  responsePayload: string;
  statusText: string;
}

export interface CNABBatchHistory {
  id: string;
  userId?: string;
  userEmail?: string;
  analista?: string;
  filename: string;
  createdDate: string;
  timestamp?: number;
  totalBoletos: number;
  totalValor: number;
  padraoCNAB: '240' | '400';
  bancoCodigo: string;
  nsa: number;
  status?: 'GERADO' | 'PROCESSADO' | 'ERRO' | 'PARCIAL';
  errorLogs?: string[];
  content?: string;
  boletos?: BoletoItem[];
}

export interface LearnedLayoutPattern {
  id: string;
  signature: string; // Fingerprint única gerada do layout
  bankCode: string;
  bankName: string;
  issuerName: string; // Beneficiário / Emissor (ex: SUHAI SEGURADORA, CLARO S.A., SEFAZ)
  layoutName: string; // Ex: "Fatura Carnê Suhai - Bradesco (237)"
  confidenceScore: number; // 0.00 a 1.00
  timesUsed: number;
  successCount: number;
  avgExtractionTimeMs: number;
  createdDate: string;
  lastUsedDate: string;
  privacySanitised: boolean; // Confirmação de remoção de dados sensíveis/PII
  
  // Âncoras do Layout
  anchors: {
    barcodePattern?: string;
    linhaDigitavelAnchor?: string;
    valorAnchor?: string;
    vencimentoAnchor?: string;
    beneficiarioAnchor?: string;
    pagadorAnchor?: string;
    pixAnchor?: string;
    seuNumeroAnchor?: string;
    nossoNumeroAnchor?: string;
  };

  // Palavras-chave do modelo de reconhecimento
  keywords: string[];

  // Extratores por Regex/Âncoras aprendidos
  fieldExtractors: {
    linhaRegex?: string;
    valorRegex?: string;
    vencimentoRegex?: string;
    favorecidoRegex?: string;
    pagadorRegex?: string;
    seuNumeroRegex?: string;
  };
}

export interface ExtratoTransaction {
  id: string;
  dataLancamento: string; // YYYY-MM-DD
  historico: string; // Descrição / Histórico
  documentoRef?: string; // Nº do documento / NSU / Autenticação
  valor: number;
  tipo: 'C' | 'D'; // C = Crédito / Entradas, D = Débito / Saídas
  codigoMovimento?: string; // ex: 01 = TED, 02 = PIX, 03 = Tarifa, 04 = DOC, etc.
  categoria?: string; // ex: "Tributos", "Tarifas Bancárias", "Transferências", "Folha"
  saldo?: number;
  bancoCodigo?: string;
  contaInfo?: string;
  valid: boolean;
  validationError?: string;
}

export interface ExcelExtratoColumnMapping {
  dataColIndex: number;
  historicoColIndex: number;
  valorColIndex: number;
  tipoColIndex: number; // Coluna contendo 'C'/'D' ou 'ENTRADA'/'SAIDA' (ou -1 se for detectado pelo sinal do valor)
  documentoColIndex: number;
  saldoColIndex: number;
  codigoMovimentoColIndex: number;
  categoriaColIndex: number;
}

export interface CNABExtratoFieldSpec {
  posInicio: number; // 1-indexed
  posFim: number;
  tamanho: number;
  tipo: 'A' | 'N'; // Alfa ou Numérico
  nomeCampo: string;
  descricao: string;
  exemplo?: string;
  identificadorCodigo?: string;
}

export interface LearnedCNABExtratoLayout {
  id: string;
  nomeLayout: string; // Ex: "Itaú Extrato 240 - Padrão Febraban"
  bancoCodigo: string;
  bancoNome: string;
  padraoCNAB: '240' | '400';
  createdDate: string;
  lastUsedDate: string;
  timesUsed: number;
  isCustomLearned: boolean;

  // Associação com Empresa e Conta Específica
  empresaId?: string;
  empresaNome?: string;
  agenciaPadrao?: string;
  contaPadrao?: string;
  convenioPadrao?: string;

  // Linhas Modelo Originais Espelhadas (Copiar exatamente campos e tamanhos)
  sampleHeaderArq?: string;
  sampleHeaderLote?: string;
  sampleSegmentE?: string;
  sampleTrailerLote?: string;
  sampleTrailerArq?: string;

  // Estrutura das posições dos registros
  headerArquivoFields: CNABExtratoFieldSpec[];
  headerLoteFields: CNABExtratoFieldSpec[];
  segmentoEFields: CNABExtratoFieldSpec[]; // Detalhe do Extrato
  trailerLoteFields: CNABExtratoFieldSpec[];
  trailerArquivoFields: CNABExtratoFieldSpec[];

  // Tabela de de/para de códigos de movimento reconhecidos
  movementCodesMap: Record<string, string>; // Código -> Categoria (ex: '01' -> 'TED Crédito', '10' -> 'Tarifa Bancária')
}

export interface MovementCodeDefinition {
  codigo: string;
  descricao: string;
  grupo: 'CREDITO' | 'DEBITO' | 'TARIFA' | 'IMPOSTO' | 'INVESTIMENTO' | 'OUTROS';
  padraoBanco?: string;
}

export interface ExtratoConversionRecord {
  id: string;
  dataConversao: string;
  nomeArquivoOriginal: string;
  nomeArquivoCNAB: string;
  qtdLancamentos: number;
  totalCreditos: number;
  totalDebitos: number;
  bancoCodigo: string;
  layoutNome: string;
  cnabContent: string;
}


