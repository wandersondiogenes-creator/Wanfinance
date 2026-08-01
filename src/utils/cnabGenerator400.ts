import { BoletoItem, CompanySettings, CNABLineHighlight } from '../types';
import { dateToCNAB, onlyNumbers } from './boletoParser';
import { formatValueCNAB, padLeftZeros, padRightSpaces } from './cnabGenerator240';

export interface GeneratedCNAB400Result {
  fileContent: string;
  totalLines: number;
  totalBoletos: number;
  totalValor: number;
  highlights: CNABLineHighlight[];
}

/**
 * Generates CNAB 400 file for Pagamento de Títulos / Boletos
 * Each line must be EXACTLY 400 characters!
 */
export function generateCNAB400(
  company: CompanySettings,
  boletos: BoletoItem[]
): GeneratedCNAB400Result {
  const lines: string[] = [];
  const highlights: CNABLineHighlight[] = [];

  const now = new Date();
  const dataGeracao = dateToCNAB(now.toISOString().split('T')[0]); // DDMMAAAA
  const bancoCodigo = padLeftZeros(company.bancoCodigo, 3);
  const inscricaoCompany = padLeftZeros(company.cnpjCpf, 14);
  const empresaNome = padRightSpaces(company.razaoSocial, 30);
  const nsa = padLeftZeros(company.nsa, 6);

  // 1. HEADER DE ARQUIVO (Tipo Registro 0) - 400 chars
  const headerParts = [
    '0',                                   // 001-001 (1) Tipo Registro = 0
    '1',                                   // 002-002 (1) Código Operação = 1 (Remessa)
    padRightSpaces('REMESSA', 7),          // 003-009 (7) Literal 'REMESSA'
    '01',                                  // 010-011 (2) Código Serviço = 01 (Cobranca/Pagamento)
    padRightSpaces('PAGAMENTOS', 15),       // 012-026 (15) Literal Serviço
    padLeftZeros(company.agencia, 4),      // 027-030 (4) Agência
    padRightSpaces(company.agenciaDV || '0', 1), // 031-031 (1) DV Agência
    padLeftZeros(company.conta, 7),        // 032-038 (7) Conta
    padRightSpaces(company.contaDV || '0', 1), // 039-039 (1) DV Conta
    padRightSpaces(company.convenio || '', 8), // 040-047 (8) Convênio
    empresaNome,                           // 048-077 (30) Razão Social
    bancoCodigo,                           // 078-080 (3) Código do Banco
    padRightSpaces(company.bancoNome, 15), // 081-095 (15) Nome do Banco
    dataGeracao,                           // 096-103 (8) Data de Gravação
    padRightSpaces('', 291),               // 104-394 (291) Brancos / Uso Reservado
    nsa,                                   // 395-400 (6) NSA Sequencial
  ];

  const headerLine = headerParts.join('');
  lines.push(headerLine);

  highlights.push({
    type: 'HEADER_400',
    lineNumber: 1,
    content: headerLine,
    description: 'Header de Arquivo CNAB 400',
    fields: [
      { pos: '001-001', name: 'Tipo', value: '0', description: 'Header de Arquivo' },
      { pos: '048-077', name: 'Empresa', value: empresaNome.trim(), description: 'Razão Social' },
      { pos: '078-080', name: 'Banco', value: bancoCodigo, description: 'Código do Banco' },
      { pos: '096-103', name: 'Data Geração', value: dataGeracao, description: 'Data do Arquivo' },
      { pos: '395-400', name: 'NSA', value: nsa, description: 'Número Sequencial' },
    ],
  });

  // 2. DETALHES (Tipo Registro 1) - 400 chars por boleto
  let totalValorBoletos = 0;

  boletos.forEach((boleto, idx) => {
    const seqNum = padLeftZeros(idx + 2, 6); // Registro 1 é header, detalhes começam em 2
    const codigoBarras = padLeftZeros(boleto.codigoBarras, 44);
    const favorecidoNome = padRightSpaces(boleto.favorecidoNome || 'BENEFICIARIO', 30);
    const docFavorecidoClean = onlyNumbers(boleto.favorecidoCnpjCpf || '00000000000000');

    const dataVencimento = dateToCNAB(boleto.dataVencimento);
    const dataPagamento = dateToCNAB(boleto.dataPagamento || boleto.dataVencimento);

    const valorTitulo = formatValueCNAB(boleto.valor, 13);
    const valorPago = formatValueCNAB(boleto.valor - (boleto.desconto || 0) + (boleto.jurosMulta || 0), 13);

    totalValorBoletos += (boleto.valor - (boleto.desconto || 0) + (boleto.jurosMulta || 0));

    const detalheParts = [
      '1',                                   // 001-001 (1) Tipo Registro = 1
      padLeftZeros(company.tipoInscricao === 'CNPJ' ? '2' : '1', 2), // 002-003 (2) Tipo Inscrição Pagador
      inscricaoCompany,                      // 004-017 (14) CNPJ/CPF Pagador
      padLeftZeros(company.agencia, 4),      // 018-021 (4) Agência
      padRightSpaces(company.agenciaDV || '0', 1), // 022-022 (1) DV Agência
      padLeftZeros(company.conta, 7),        // 023-029 (7) Conta
      padRightSpaces(company.contaDV || '0', 1), // 030-030 (1) DV Conta
      padRightSpaces(boleto.seuNumero || `PAG-${idx + 1}`, 25), // 031-055 (25) Seu Número / Ref
      codigoBarras,                          // 056-099 (44) Código de Barras de 44 dígitos
      favorecidoNome,                        // 100-129 (30) Nome Beneficiário
      padLeftZeros(docFavorecidoClean, 14),  // 130-143 (14) CPF/CNPJ Beneficiário
      dataVencimento,                        // 144-151 (8) Vencimento
      valorTitulo,                           // 152-164 (13) Valor Título
      dataPagamento,                         // 165-172 (8) Data Agendada Pagamento
      valorPago,                             // 173-185 (13) Valor Efetivo Pagamento
      padRightSpaces('', 209),               // 186-394 (209) Reservado / Observações
      seqNum,                                // 395-400 (6) Sequencial de Linha
    ];

    const detalheLine = detalheParts.join('');
    lines.push(detalheLine);

    highlights.push({
      type: 'DETALHE_400',
      lineNumber: lines.length,
      content: detalheLine,
      description: `Registro Detalhe CNAB 400 (Boleto #${idx + 1}) - ${boleto.favorecidoNome}`,
      fields: [
        { pos: '031-055', name: 'Seu Número', value: (boleto.seuNumero || `PAG-${idx + 1}`), description: 'Identificação Interna' },
        { pos: '056-099', name: 'Código Barras', value: codigoBarras, description: '44 dígitos do código de barras' },
        { pos: '100-129', name: 'Beneficiário', value: favorecidoNome.trim(), description: 'Nome do Recebedor' },
        { pos: '144-151', name: 'Vencimento', value: dataVencimento, description: 'Data de Vencimento' },
        { pos: '173-185', name: 'Valor Pago', value: `R$ ${(boleto.valor).toFixed(2)}`, description: 'Valor total' },
      ],
    });
  });

  // 3. TRAILER DE ARQUIVO (Tipo Registro 9) - 400 chars
  const totalLinhas = lines.length + 1;
  const seqTrailer = padLeftZeros(totalLinhas, 6);
  const somatorioValores = formatValueCNAB(totalValorBoletos, 13);

  const trailerParts = [
    '9',                                   // 001-001 (1) Tipo Registro = 9
    padLeftZeros(boletos.length, 6),       // 002-007 (6) Total de Boletos
    somatorioValores,                      // 008-020 (13) Total de Valor
    padRightSpaces('', 374),               // 021-394 (374) Reservado
    seqTrailer,                            // 395-400 (6) Sequencial da Linha
  ];

  const trailerLine = trailerParts.join('');
  lines.push(trailerLine);

  highlights.push({
    type: 'TRAILER_400',
    lineNumber: lines.length,
    content: trailerLine,
    description: 'Trailer de Arquivo CNAB 400',
    fields: [
      { pos: '002-007', name: 'Qtd Boletos', value: String(boletos.length), description: 'Quantidade de registros' },
      { pos: '008-020', name: 'Valor Total', value: `R$ ${totalValorBoletos.toFixed(2)}`, description: 'Somatório Geral' },
      { pos: '395-400', name: 'Linhas Totais', value: String(totalLinhas), description: 'Total de linhas no arquivo' },
    ],
  });

  return {
    fileContent: lines.join('\r\n'),
    totalLines: lines.length,
    totalBoletos: boletos.length,
    totalValor: totalValorBoletos,
    highlights,
  };
}
