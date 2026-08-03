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
