import * as XLSX from 'xlsx';
import { CompanyProfile } from '../types';
import { DEFAULT_COMPANIES, SANTANDER_PAGFOR_DATA } from '../data/defaultCompanies';

export function formatCNPJ(cnpj: string): string {
  const clean = (cnpj || '').replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return cnpj;
}

export function buildCompaniesExcelWorkbook(companiesList: CompanyProfile[] = DEFAULT_COMPANIES) {
  const wb = XLSX.utils.book_new();

  // 1. Aba: Resumo Consolidado (Empresas e Contas)
  const rowsConsolidado: any[] = [];
  companiesList.forEach((company, empIdx) => {
    company.bancos.forEach((banco, bIdx) => {
      const isSantander = banco.bancoCodigo === '033';
      rowsConsolidado.push({
        'Nº': rowsConsolidado.length + 1,
        'Razão Social da Empresa': company.razaoSocial,
        'Nome Fantasia / Apelido': company.nomeFantasia,
        'CNPJ': formatCNPJ(company.cnpjCpf),
        'Cidade / UF': `${company.cidade} / ${company.uf}`,
        'Apelido da Conta Bancária': banco.apelido,
        'Banco': `[${banco.bancoCodigo}] ${banco.bancoNome}`,
        'Código Banco': banco.bancoCodigo,
        'Agência': banco.agencia,
        'DV Agência': banco.agenciaDV || '0',
        'Conta': banco.conta,
        'DV Conta': banco.contaDV || '0',
        'Código de Convênio no Banco': banco.convenio || '',
        'Código de Estação (Santander)': isSantander ? (banco.codigoEstacao || banco.codigoTransmissao || '') : '',
        'Cód. Transmissão (Outros)': !isSantander ? (banco.codigoTransmissao || banco.convenio || '') : '',
        'Padrão CNAB': `CNAB ${banco.padraoCNAB}`,
        'Versão Layout Lote': banco.layoutVersaoLote,
        'Próximo NSA': banco.nsa,
      });
    });
  });
  const wsConsolidado = XLSX.utils.json_to_sheet(rowsConsolidado);
  wsConsolidado['!cols'] = [
    { wch: 5 },  // Nº
    { wch: 45 }, // Razão Social
    { wch: 28 }, // Nome Fantasia
    { wch: 20 }, // CNPJ
    { wch: 22 }, // Cidade / UF
    { wch: 32 }, // Apelido Conta
    { wch: 32 }, // Banco
    { wch: 12 }, // Cod Banco
    { wch: 10 }, // Agência
    { wch: 10 }, // DV Agência
    { wch: 14 }, // Conta
    { wch: 10 }, // DV Conta
    { wch: 26 }, // Convênio
    { wch: 26 }, // Estação
    { wch: 24 }, // Transmissão
    { wch: 14 }, // CNAB
    { wch: 18 }, // Versão Lote
    { wch: 12 }, // NSA
  ];
  XLSX.utils.book_append_sheet(wb, wsConsolidado, 'Consolidado Contas');

  // 2. Aba: Cadastro de Empresas (Conforme Print 1)
  const rowsEmpresas = companiesList.map((company, idx) => ({
    'Ordem': idx + 1,
    'RAZÃO SOCIAL DA EMPRESA': company.razaoSocial,
    'TIPO': company.tipoInscricao || 'CNPJ',
    'NÚMERO DO CNPJ / CPF': formatCNPJ(company.cnpjCpf),
    'CNPJ (Apenas Números)': (company.cnpjCpf || '').replace(/\D/g, ''),
    'NOME FANTASIA / APELIDO': company.nomeFantasia,
    'CIDADE': company.cidade,
    'UF': company.uf,
    'LOGRADOURO': company.logradouro || '',
    'NÚMERO': company.numero || '',
    'COMPLEMENTO': company.complemento || '',
    'CEP': company.cep || '',
    'QUANTIDADE DE CONTAS': company.bancos.length,
  }));
  const wsEmpresas = XLSX.utils.json_to_sheet(rowsEmpresas);
  wsEmpresas['!cols'] = [
    { wch: 8 },  // Ordem
    { wch: 45 }, // Razão Social
    { wch: 8 },  // Tipo
    { wch: 22 }, // CNPJ formatado
    { wch: 18 }, // CNPJ limpo
    { wch: 28 }, // Fantasia
    { wch: 22 }, // Cidade
    { wch: 6 },  // UF
    { wch: 35 }, // Logradouro
    { wch: 10 }, // Número
    { wch: 20 }, // Bairro
    { wch: 12 }, // CEP
    { wch: 20 }, // Qtd Contas
  ];
  XLSX.utils.book_append_sheet(wb, wsEmpresas, 'Cadastro Empresas Pagadoras');

  // 3. Aba: Cadastro de Contas Bancárias (Conforme Print 2)
  const rowsContas: any[] = [];
  companiesList.forEach((company) => {
    company.bancos.forEach((banco) => {
      const isSantander = banco.bancoCodigo === '033';
      rowsContas.push({
        'EMPRESA VINCULADA': company.nomeFantasia,
        'CNPJ EMPRESA': formatCNPJ(company.cnpjCpf),
        'APELIDO DA CONTA BANCÁRIA': banco.apelido,
        'BANCO': `[${banco.bancoCodigo}] ${banco.bancoNome}`,
        'AGÊNCIA': banco.agencia,
        'DV AGÊNCIA': banco.agenciaDV || '0',
        'CONTA': banco.conta,
        'DV CONTA': banco.contaDV || '0',
        'CÓDIGO DE CONVÊNIO NO BANCO': banco.convenio || '',
        'CÓDIGO DE ESTAÇÃO (SANTANDER)': isSantander ? (banco.codigoEstacao || banco.codigoTransmissao || '') : '',
        'CÓD. TRANSMISSÃO (OUTROS)': !isSantander ? (banco.codigoTransmissao || banco.convenio || '') : '',
        'PADRÃO CNAB': `CNAB ${banco.padraoCNAB}`,
        'VERSÃO LAYOUT LOTE': banco.layoutVersaoLote,
        'PRÓXIMO NSA': banco.nsa,
      });
    });
  });
  const wsContas = XLSX.utils.json_to_sheet(rowsContas);
  wsContas['!cols'] = [
    { wch: 28 }, // Empresa
    { wch: 20 }, // CNPJ
    { wch: 32 }, // Apelido Conta
    { wch: 32 }, // Banco
    { wch: 10 }, // Agência
    { wch: 10 }, // DV Ag
    { wch: 14 }, // Conta
    { wch: 10 }, // DV Cta
    { wch: 26 }, // Convênio
    { wch: 26 }, // Estação Santander
    { wch: 24 }, // Transmissão
    { wch: 14 }, // CNAB
    { wch: 18 }, // Versão Lote
    { wch: 12 }, // NSA
  ];
  XLSX.utils.book_append_sheet(wb, wsContas, 'Cadastro Contas Bancarias');

  // 4. Aba: Santander Pagfor (Tabela Rápida)
  const rowsSantander = SANTANDER_PAGFOR_DATA.map((item, idx) => ({
    'Item': idx + 1,
    'Nome / Unidade Santander': item.nome,
    'CNPJ': formatCNPJ(item.cnpj),
    'Agência': item.agencia,
    'Conta': item.conta,
    'DV': item.contaDV,
    'Código de Convênio': item.convenio || '(Em branco)',
    'Código de Estação': item.codigoEstacao || '(Em branco)',
  }));
  const wsSantander = XLSX.utils.json_to_sheet(rowsSantander);
  wsSantander['!cols'] = [
    { wch: 6 },
    { wch: 45 },
    { wch: 22 },
    { wch: 10 },
    { wch: 14 },
    { wch: 6 },
    { wch: 22 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSantander, 'Santander Pagfor');

  return wb;
}

/**
 * Função utilitária para download direto no navegador (Client-side)
 */
export function downloadCompaniesExcel(companiesList?: CompanyProfile[], fileName = 'Cadastro_Empresas_e_Contas_Bancarias.xlsx') {
  const wb = buildCompaniesExcelWorkbook(companiesList);
  XLSX.writeFile(wb, fileName);
}
