import { SmartDocCategory } from './smartDocTypes';

export interface ClassificationResult {
  category: SmartDocCategory;
  confidence: number;
  detectedBrand?: string;
  matchedKeywords: string[];
  suggestedParser: string;
}

/**
 * Classificador Inteligente Automático de Documentos Financeiros
 */
export function classifySmartDocument(text: string, fileName: string = ''): ClassificationResult {
  const normalized = (text + ' ' + fileName).toLowerCase();

  // 1. Detecção de Boletos de Montadoras & FIDC Automotivo
  const automotiveKeywords = [
    { brand: 'LEAPMOTOR / STELLANTIS', keys: ['leapmotor', 'leap motor', 'leap', 'stellantis financial', 'fiat chrysler automoveis'] },
    { brand: 'GEELY / VOLVO', keys: ['geely', 'geely auto', 'volvo car'] },
    { brand: 'OMODA & JAECOO (CHERY)', keys: ['omoda', 'jaecoo', 'omoda & jaecoo', 'chery brasil', 'omoda 5'] },
    { brand: 'FIAT / FIDC VITA AUTO', keys: ['fidc vita auto', 'vita auto', 'fiat', 'banco fidis', '050.095.909/0001-49', '02856-cobflex', 'paulo camilo-betim', 'via sul veiculos'] },
    { brand: 'JEEP / BANCO FIDIS', keys: ['jeep', 'fidis', 'banco fidis', '062.237.425/0001-76', '02011-cobflex', 'goiana-pe'] },
    { brand: 'RENAULT / FIDC VEÍCULOS', keys: ['renault', 'fidc venda de veiculos', '21.126.275/0001-46', 'banco rci', 'rci brasil'] },
    { brand: 'NISSAN', keys: ['nissan', 'nissan do brasil', 'banco rci nissan'] },
    { brand: 'NEWVIA', keys: ['newvia', 'new via', 'newvia veiculos'] },
    { brand: 'FORD / FIDC AUTO FORD', keys: ['fidc complementar auto ford', 'fidc auto ford', 'granvia veiculos', '043.489.824/0001-80', 'ford motor'] },
    { brand: 'BYD DO BRASIL / AUTO', keys: ['byd auto', 'byd do brasil', '17.140.820/0007-77', '50.351.104/0001-19', 'build your dreams', '0339905481', '0339901241'] },
    { brand: 'BAJAJ / J.P. MORGAN', keys: ['bajaj', 'bajaj do brasil', '45.859.932/0001-22', 'banco j.p. morgan', 'jpmorgan'] },
    { brand: 'TOYOTA', keys: ['banco toyota', 'toyota do brasil', 'toyota financial'] },
    { brand: 'VOLKSWAGEN', keys: ['banco volkswagen', 'volkswagen do brasil', 'vw financial'] },
    { brand: 'HYUNDAI', keys: ['hyundai capital', 'banco hyundai', 'hyundai motor'] },
    { brand: 'GM / CHEVROLET', keys: ['banco gm', 'general motors', 'chevrolet serviços'] },
    { brand: 'HONDA', keys: ['banco honda', 'honda automoveis'] },
    { brand: 'GENERIC_AUTO', keys: ['chassi', 'compromisso', 'relação ao caixa', 'relacao ao caixa', 'concessionaria', 'veiculos s/a', 'fundo de investimento em direitos creditorios'] }
  ];

  for (const auto of automotiveKeywords) {
    const matched = auto.keys.filter(k => normalized.includes(k));
    if (matched.length >= 1 && (normalized.includes('chassi') || normalized.includes('compromisso') || normalized.includes('fidc') || normalized.includes('veiculo') || matched.length >= 2)) {
      return {
        category: 'montadora_fidc',
        confidence: 0.96,
        detectedBrand: auto.brand !== 'GENERIC_AUTO' ? auto.brand : undefined,
        matchedKeywords: matched,
        suggestedParser: 'AutomotiveMontadoraParser',
      };
    }
  }

  // 2. Detecção de DETRAN / IPVA / Trânsito
  const detranKeys = ['detran', 'ipva', 'licenciamento', 'taxa de transito', 'dpvat', 'auto de infracao', 'infracao de transito', 'secretaria da fazenda - ipva', 'renavam'];
  const matchedDetran = detranKeys.filter(k => normalized.includes(k));
  if (matchedDetran.length >= 2 || (normalized.includes('detran') && (normalized.includes('renavam') || normalized.includes('placa')))) {
    return {
      category: 'detran_ipva',
      confidence: 0.95,
      matchedKeywords: matchedDetran,
      suggestedParser: 'DetranIpvaParser',
    };
  }

  // 3. Detecção de DARF / DAS / Tributos Federais
  const darfKeys = ['darf', 'simples nacional', 'das - documento de arrecadação', 'documento de arrecadação de receitas federais', 'receita federal', 'codigo da receita', 'periodo de apuração', 'periodo de apuracao', 'ministerio da fazenda', 'pgfn'];
  const matchedDarf = darfKeys.filter(k => normalized.includes(k));
  if (matchedDarf.length >= 2 || normalized.includes('darf') || normalized.includes('simples nacional')) {
    return {
      category: 'darf_das_tributos',
      confidence: 0.94,
      matchedKeywords: matchedDarf,
      suggestedParser: 'TaxDarfDasParser',
    };
  }

  // 4. Detecção de GRU (Guia de Recolhimento da União)
  const gruKeys = ['guia de recolhimento da união', 'guia de recolhimento da uniao', 'gru simples', 'gru cobranca', 'gru cobrança', 'secretaria do tesouro nacional', 'unidade gestora', 'gestão', 'codigo de recolhimento'];
  const matchedGru = gruKeys.filter(k => normalized.includes(k));
  if (matchedGru.length >= 2 || normalized.includes('guia de recolhimento da união') || normalized.includes('gru simples')) {
    return {
      category: 'gru_uniao',
      confidence: 0.95,
      matchedKeywords: matchedGru,
      suggestedParser: 'GruUniaoParser',
    };
  }

  // 5. Detecção de GNRE / ICMS
  const gnreKeys = ['gnre', 'guia nacional de recolhimento de tributos estaduais', 'icms st', 'difal', 'uf favorecida', 'detalhamento da receita', 'tributo estadual'];
  const matchedGnre = gnreKeys.filter(k => normalized.includes(k));
  if (matchedGnre.length >= 2 || normalized.includes('gnre') || normalized.includes('guia nacional de recolhimento')) {
    return {
      category: 'gnre_icms',
      confidence: 0.95,
      matchedKeywords: matchedGnre,
      suggestedParser: 'GnreIcmsParser',
    };
  }

  // 6. Detecção de Concessionárias / Utilidades (Água, Luz, Gás, Telecom)
  const utilityKeys = ['enel', 'cpfl', 'cemig', 'light', 'copel', 'neoenergia', 'sabesp', 'copasa', 'sanepar', 'embasa', 'cagece', 'vivo', 'telefonica', 'claro', 'tim', 'comgas', 'energia eletrica', 'fatura de agua', 'consumo de energia'];
  const matchedUtility = utilityKeys.filter(k => normalized.includes(k));
  if (matchedUtility.length >= 1 && (normalized.includes('fatura') || normalized.includes('consumo') || normalized.includes('kwh') || normalized.includes('m3') || normalized.includes('vencimento'))) {
    return {
      category: 'concessionarias',
      confidence: 0.92,
      matchedKeywords: matchedUtility,
      suggestedParser: 'UtilityParser',
    };
  }

  // 7. Padrão: Boleto Bancário Tradicional
  return {
    category: 'boleto_bancario',
    confidence: 0.85,
    matchedKeywords: ['febraban', 'titulo_bancario'],
    suggestedParser: 'StandardBoletoParser',
  };
}
