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

export interface CNABBatchHistory {
  id: string;
  nsa: number;
  filename: string;
  createdDate: string;
  totalBoletos: number;
  totalValor: number;
  padraoCNAB: '240' | '400';
  bancoCodigo: string;
  content: string;
  boletos: BoletoItem[];
  analista?: string;
}
