export type SmartDocCategory =
  | 'auto_detect'
  | 'montadora_fidc'
  | 'boleto_bancario'
  | 'detran_ipva'
  | 'darf_das_tributos'
  | 'gru_uniao'
  | 'gnre_icms'
  | 'concessionarias';

export type SmartValidationStatus = 'valid' | 'warning' | 'error';

export interface SmartFieldValidation {
  status: SmartValidationStatus;
  message?: string;
  isVerified?: boolean;
}

export interface SmartValidationSummary {
  overallStatus: SmartValidationStatus;
  score: number; // 0 to 100
  barcode: SmartFieldValidation;
  valor: SmartFieldValidation;
  vencimento: SmartFieldValidation;
  beneficiario: SmartFieldValidation;
  beneficiarioCnpjCpf: SmartFieldValidation;
  pagador: SmartFieldValidation;
  pagadorCnpjCpf: SmartFieldValidation;
  numeroDocumento: SmartFieldValidation;
  veiculoDados?: SmartFieldValidation;
  requiresReview: boolean;
  reviewReasons: string[];
}

export interface SmartExtractedDocument {
  id: string;
  fileName: string;
  fileSize?: number;
  docCategory: SmartDocCategory;
  detectedCategory: SmartDocCategory;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  processingTimeMs: number;
  errorMessage?: string;
  
  // Core extracted data
  linhaDigitavel: string;
  codigoBarras: string;
  favorecidoNome: string;
  favorecidoCnpjCpf: string;
  pagadorNome: string;
  pagadorCnpjCpf: string;
  valor: number;
  valorOriginal?: number;
  valorCobrado?: number;
  desconto?: number;
  jurosMulta?: number;
  dataVencimento: string;
  dataEmissao?: string;
  dataPagamento?: string;
  seuNumero: string;
  nossoNumero: string;
  bancoCodigo: string;
  bancoNome: string;
  tipoBoleto: string;

  // Specific domain fields
  montadoraMarca?: string;
  chassi?: string;
  placa?: string;
  renavam?: string;
  autoInfracao?: string;
  codigoReceita?: string;
  periodoApuracao?: string;
  numeroReferencia?: string;
  ugGestao?: string;
  ufFavorecida?: string;
  observacoes?: string;

  // Metadata & Engine info
  layoutName?: string;
  isLearnedLayout?: boolean;
  confidence: number;
  rawTextPreview?: string;
  
  // Validation engine result
  validation: SmartValidationSummary;
  
  // UI selection in batch
  selected: boolean;
}

export interface SmartDocTypeOption {
  id: SmartDocCategory;
  name: string;
  badge: string;
  badgeColor: string;
  iconName: string;
  description: string;
  examples: string[];
}

export interface SmartLearnedLayoutItem {
  id: string;
  category: SmartDocCategory;
  signature: string;
  layoutName: string;
  issuerName: string;
  issuerCnpj?: string;
  bankCode?: string;
  timesUsed: number;
  successRate: number;
  createdAt: string;
  lastUsedAt: string;
  sampleKeywords: string[];
}
