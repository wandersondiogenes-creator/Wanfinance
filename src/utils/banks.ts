export interface BankInfo {
  code: string;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
}

export const BRAZILIAN_BANKS: Record<string, BankInfo> = {
  '001': { code: '001', name: 'Banco do Brasil S.A.', shortName: 'Banco do Brasil', color: '#1B4A9B', bgColor: '#FEF08A' },
  '237': { code: '237', name: 'Banco Bradesco S.A.', shortName: 'Bradesco', color: '#CC092F', bgColor: '#FEE2E2' },
  '341': { code: '341', name: 'Itaú Unibanco S.A.', shortName: 'Itaú', color: '#EC7000', bgColor: '#FFEDD5' },
  '033': { code: '033', name: 'Banco Santander Brasil S.A.', shortName: 'Santander', color: '#EC0000', bgColor: '#FEE2E2' },
  '104': { code: '104', name: 'Caixa Econômica Federal', shortName: 'Caixa', color: '#005CA9', bgColor: '#DBEAFE' },
  '756': { code: '756', name: 'Banco Cooperativo Sicoob S.A.', shortName: 'Sicoob', color: '#003641', bgColor: '#CCFBF1' },
  '748': { code: '748', name: 'Banco Cooperativo Sicredi S.A.', shortName: 'Sicredi', color: '#007A33', bgColor: '#DCFCE7' },
  '077': { code: '077', name: 'Banco Inter S.A.', shortName: 'Inter', color: '#FF7A00', bgColor: '#FFEDD5' },
  '260': { code: '260', name: 'Nu Pagamentos S.A.', shortName: 'Nubank', color: '#820AD1', bgColor: '#F3E8FF' },
  '336': { code: '336', name: 'Banco C6 S.A.', shortName: 'C6 Bank', color: '#242424', bgColor: '#F3F4F6' },
  '422': { code: '422', name: 'Banco Alfa / Financeira Alfa S.A.', shortName: 'Financeira Alfa', color: '#991B1B', bgColor: '#FEE2E2' },
  '376': { code: '376', name: 'J.P. Morgan S.A.', shortName: 'J.P. Morgan', color: '#111827', bgColor: '#F3F4F6' },
  '318': { code: '318', name: 'Banco Trianon / BMG', shortName: 'Banco Trianon', color: '#EA580C', bgColor: '#FFEDD5' },
  '212': { code: '212', name: 'Banco Original S.A.', shortName: 'Original', color: '#00A859', bgColor: '#DCFCE7' },
  '655': { code: '655', name: 'Banco Votorantim S.A. / BV', shortName: 'BV', color: '#003399', bgColor: '#DBEAFE' },
  '041': { code: '041', name: 'Banco do Estado do Rio Grande do Sul (Banrisul)', shortName: 'Banrisul', color: '#00529C', bgColor: '#DBEAFE' },
  '070': { code: '070', name: 'BRB - Banco de Brasília S.A.', shortName: 'BRB', color: '#005BB5', bgColor: '#DBEAFE' },
  '136': { code: '136', name: 'Unicred Cooperativa', shortName: 'Unicred', color: '#005C36', bgColor: '#DCFCE7' },
  '858': { code: '858', name: 'GNRE - Guia Nacional de Recolhimento de Tributos Estaduais', shortName: 'GNRE / Tributo Estadual', color: '#0284C7', bgColor: '#E0F2FE' },
  '856': { code: '856', name: 'DARF / GPS / Tributos Federais', shortName: 'Tributo Federal', color: '#15803D', bgColor: '#DCFCE7' },
  '800': { code: '800', name: 'Concessionária / Arrecadação / Tributos', shortName: 'Concessionária/Tributos', color: '#0369A1', bgColor: '#E0F2FE' },
};

export function getBankInfo(code: string): BankInfo {
  const cleanCode = (code || '').padStart(3, '0');
  if (BRAZILIAN_BANKS[cleanCode]) {
    return BRAZILIAN_BANKS[cleanCode];
  }

  if (cleanCode.startsWith('858') || cleanCode === '858') {
    return BRAZILIAN_BANKS['858'];
  }

  if (cleanCode.startsWith('856') || cleanCode === '856') {
    return BRAZILIAN_BANKS['856'];
  }

  if (cleanCode.startsWith('8')) {
    return {
      code: cleanCode,
      name: 'Arrecadação / Tributos / Concessionária',
      shortName: 'Tributo / Arrecadação',
      color: '#0369A1',
      bgColor: '#E0F2FE',
    };
  }

  return {
    code: cleanCode,
    name: `Banco ${cleanCode}`,
    shortName: `Banco ${cleanCode}`,
    color: '#4B5563',
    bgColor: '#F3F4F6',
  };
}
