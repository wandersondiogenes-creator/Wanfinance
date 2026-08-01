import { BoletoItem, CompanySettings, CNABLineHighlight } from '../types';
import { dateToCNAB, onlyNumbers } from './boletoParser';

/**
 * Normalizes text to uppercase ASCII without accents or special characters
 */
export function removeAccents(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s.-]/g, '');
}

export function padRightSpaces(text: string, length: number): string {
  const clean = removeAccents(text || '');
  return clean.padEnd(length, ' ').substring(0, length);
}

export function padLeftZeros(value: string | number, length: number): string {
  const clean = onlyNumbers(String(value ?? ''));
  return clean.padStart(length, '0').substring(0, length);
}

/**
 * Formats a monetary amount into cents integer with fixed width
 * ex: 1234.56 -> 123456 -> padded to length
 */
export function formatValueCNAB(amount: number, length: number): string {
  const cents = Math.round((amount || 0) * 100);
  return padLeftZeros(cents, length);
}

export interface GeneratedCNAB240Result {
  fileContent: string;
  totalLines: number;
  totalLotes: number;
  totalBoletos: number;
  totalValor: number;
  highlights: CNABLineHighlight[];
}

/**
 * Generates FEBRABAN CNAB 240 file for Pagamento de Títulos / Boletos
 */
export function generateCNAB240(
  company: CompanySettings,
  boletos: BoletoItem[]
): GeneratedCNAB240Result {
  const lines: string[] = [];
  const highlights: CNABLineHighlight[] = [];

  const now = new Date();
  const dataGeracao = dateToCNAB(now.toISOString().split('T')[0]); // DDMMAAAA
  const horaGeracao = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`; // HHMMSS

  const bancoCodigo = padLeftZeros(company.bancoCodigo, 3);
  const tipoInscricaoCompany = company.tipoInscricao === 'CNPJ' ? '2' : '1';
  const inscricaoCompany = padLeftZeros(company.cnpjCpf, 14);

  const agencia = padLeftZeros(company.agencia, 5);
  const agenciaDV = padRightSpaces(company.agenciaDV || '0', 1);
  const conta = padLeftZeros(company.conta, 12);
  const contaDV = padRightSpaces(company.contaDV || '0', 1);
  const agenciaContaDV = ' ';

  const convenio = padRightSpaces(company.convenio || '', 20);
  const empresaNome = padRightSpaces(company.razaoSocial, 30);
  const bancoNome = padRightSpaces(company.bancoNome, 30);
  const nsa = padLeftZeros(company.nsa, 6);

  // 1. HEADER DE ARQUIVO (Tipo Registro 0)
  const headerArquivoParts = [
    bancoCodigo,                           // 001-003 (3) Banco
    '0000',                                // 004-007 (4) Lote de serviço
    '0',                                   // 008-008 (1) Tipo de registro = 0
    '         ',                           // 009-017 (9) Reservado FEBRABAN
    tipoInscricaoCompany,                  // 018-018 (1) Tipo inscrição
    inscricaoCompany,                      // 019-032 (14) CNPJ/CPF Empresa
    convenio,                              // 033-052 (20) Convênio no banco
    agencia,                               // 053-057 (5) Agência
    agenciaDV,                             // 058-058 (1) DV Agência
    conta,                                 // 059-070 (12) Conta Corrente
    contaDV,                               // 071-071 (1) DV Conta
    agenciaContaDV,                        // 072-072 (1) DV Ag/Conta
    empresaNome,                           // 073-102 (30) Nome da Empresa
    bancoNome,                             // 103-132 (30) Nome do Banco
    padRightSpaces('', 10),                // 133-142 (10) Reservado FEBRABAN
    '1',                                   // 143-143 (1) Código Remessa = 1
    dataGeracao,                           // 144-151 (8) Data Geração (DDMMAAAA)
    horaGeracao,                           // 152-157 (6) Hora Geração (HHMMSS)
    nsa,                                   // 158-163 (6) NSA Sequencial Arquivo
    '103',                                 // 164-166 (3) Versão Layout Arquivo
    '01600',                               // 167-171 (5) Densidade Gravação
    padRightSpaces('', 20),                // 172-191 (20) Reservado Banco
    padRightSpaces('', 20),                // 192-211 (20) Reservado Empresa
    padRightSpaces('', 29),                // 212-240 (29) Reservado FEBRABAN
  ];

  const headerArquivo = headerArquivoParts.join('');
  lines.push(headerArquivo);

  highlights.push({
    type: 'HEADER_ARQUIVO',
    lineNumber: 1,
    content: headerArquivo,
    description: 'Header de Arquivo - Identificação da empresa pagadora e do banco',
    fields: [
      { pos: '001-003', name: 'Banco', value: bancoCodigo, description: 'Código do Banco Pagador' },
      { pos: '019-032', name: 'CNPJ/CPF', value: inscricaoCompany, description: 'Documento da Empresa' },
      { pos: '073-102', name: 'Empresa', value: empresaNome.trim(), description: 'Razão Social da Empresa' },
      { pos: '144-151', name: 'Data Geração', value: dataGeracao, description: 'Data do Arquivo' },
      { pos: '158-163', name: 'NSA', value: nsa, description: 'Número Sequencial do Arquivo' },
    ],
  });

  // 2. HEADER DE LOTE (Tipo Registro 1 - Pagamento de Títulos / Boletos)
  const loteServico = '0001';
  const headerLoteParts = [
    bancoCodigo,                           // 001-003 (3) Banco
    loteServico,                           // 004-007 (4) Lote = 0001
    '1',                                   // 008-008 (1) Tipo de registro = 1
    'C',                                   // 009-009 (1) Operação = C (Crédito)
    '30',                                  // 010-011 (2) Serviço = 30 (Pagamento de Títulos/Boletos)
    '31',                                  // 012-013 (2) Forma Lançamento = 31 (Boletos Outros Bancos/Geral)
    company.layoutVersaoLote || '046',      // 014-016 (3) Versão Layout Lote
    ' ',                                   // 017-017 (1) Reservado FEBRABAN
    tipoInscricaoCompany,                  // 018-018 (1) Tipo inscrição
    inscricaoCompany,                      // 019-032 (14) CNPJ/CPF Empresa
    convenio,                              // 033-052 (20) Convênio
    agencia,                               // 053-057 (5) Agência
    agenciaDV,                             // 058-058 (1) DV Agência
    conta,                                 // 059-070 (12) Conta Corrente
    contaDV,                               // 071-071 (1) DV Conta
    agenciaContaDV,                        // 072-072 (1) DV Ag/Conta
    empresaNome,                           // 073-102 (30) Nome da Empresa
    padRightSpaces('PAGAMENTO DE BOLETOS BANCARIOS', 40), // 103-142 (40) Mensagem
    padRightSpaces(company.logradouro || 'RUA PRINCIPAL', 30), // 143-172 (30) Logradouro
    padLeftZeros(company.numero || '100', 5), // 173-177 (5) Número
    padRightSpaces(company.complemento || '', 15), // 178-192 (15) Complemento
    padRightSpaces(company.cidade || 'SAO PAULO', 15), // 193-207 (15) Cidade
    padLeftZeros(company.cep || '01000000', 8), // 208-215 (8) CEP
    padRightSpaces(company.uf || 'SP', 2), // 216-217 (2) UF
    padRightSpaces('', 8),                 // 218-225 (8) Indicativo Forma Pagamento
    padRightSpaces('', 15),                // 226-240 (15) Reservado FEBRABAN
  ];

  const headerLote = headerLoteParts.join('');
  lines.push(headerLote);

  highlights.push({
    type: 'HEADER_LOTE',
    lineNumber: 2,
    content: headerLote,
    description: 'Header de Lote - Especifica o tipo de lote (Pagamento de Títulos/Boletos)',
    fields: [
      { pos: '004-007', name: 'Lote', value: loteServico, description: 'Número do Lote' },
      { pos: '010-011', name: 'Serviço', value: '30', description: 'Pagamento de Títulos/Boletos' },
      { pos: '073-102', name: 'Empresa', value: empresaNome.trim(), description: 'Razão Social' },
      { pos: '208-217', name: 'Endereço', value: `${company.cidade}/${company.uf}`, description: 'Localização da Empresa' },
    ],
  });

  // 3. REGISTROS DETALHE (Segmento J + Segmento J-52 para cada boleto)
  let sequencialRegistroNoLote = 0;
  let totalValorBoletos = 0;

  boletos.forEach((boleto, idx) => {
    // SEGMENTO J (Tipo 3)
    sequencialRegistroNoLote += 1;
    const seqStr = padLeftZeros(sequencialRegistroNoLote, 5);

    const codigoBarras = padLeftZeros(boleto.codigoBarras, 44);
    const favorecidoNome = padRightSpaces(boleto.favorecidoNome || 'BENEFICIARIO BOLETO', 30);
    const dataVencimento = dateToCNAB(boleto.dataVencimento);
    const valorTitulo = formatValueCNAB(boleto.valor, 15);
    const valorDesconto = formatValueCNAB(boleto.desconto || 0, 15);
    const valorJurosMulta = formatValueCNAB(boleto.jurosMulta || 0, 15);
    const dataPagamento = dateToCNAB(boleto.dataPagamento || boleto.dataVencimento);
    const valorPagamento = formatValueCNAB(boleto.valor - (boleto.desconto || 0) + (boleto.jurosMulta || 0), 15);
    const seuNumero = padRightSpaces(boleto.seuNumero || `BOL-${idx + 1}`, 20);
    const nossoNumero = padRightSpaces(boleto.nossoNumero || '', 20);

    totalValorBoletos += (boleto.valor - (boleto.desconto || 0) + (boleto.jurosMulta || 0));

    const segmentoJParts = [
      bancoCodigo,                           // 001-003 (3) Banco
      loteServico,                           // 004-007 (4) Lote
      '3',                                   // 008-008 (1) Tipo de registro = 3
      seqStr,                                // 009-013 (5) N° Sequencial Registro no Lote
      'J',                                   // 014-014 (1) Código do Segmento = J
      '000',                                 // 015-017 (3) Tipo Movimento = 000 (Inclusão)
      codigoBarras,                          // 018-061 (44) Código de Barras
      favorecidoNome,                        // 062-091 (30) Nome do Favorecido/Beneficiário
      dataVencimento,                        // 092-099 (8) Data de Vencimento
      valorTitulo,                           // 100-114 (15) Valor do Título
      valorDesconto,                         // 115-129 (15) Valor do Desconto
      valorJurosMulta,                       // 130-144 (15) Valor Juros/Multa
      dataPagamento,                         // 145-152 (8) Data do Pagamento
      valorPagamento,                        // 153-167 (15) Valor do Pagamento Efetivo
      padLeftZeros('0', 15),                 // 168-182 (15) Quantidade Moeda
      seuNumero,                             // 183-202 (20) Seu Número / Ref Empresa
      nossoNumero,                           // 203-222 (20) Nosso Número / Ref Banco
      '09',                                  // 223-224 (2) Código da Moeda (09 = Real)
      padRightSpaces('', 6),                 // 225-230 (6) Reservado FEBRABAN
      padRightSpaces('', 10),                // 231-240 (10) Ocorrências
    ];

    const linhaSegmentoJ = segmentoJParts.join('');
    lines.push(linhaSegmentoJ);

    highlights.push({
      type: 'SEGMENTO_J',
      lineNumber: lines.length,
      content: linhaSegmentoJ,
      description: `Segmento J (Boleto #${idx + 1}) - ${boleto.favorecidoNome}`,
      fields: [
        { pos: '018-061', name: 'Código de Barras', value: codigoBarras, description: '44 dígitos do código de barras' },
        { pos: '062-091', name: 'Favorecido', value: favorecidoNome.trim(), description: 'Nome do Beneficiário' },
        { pos: '092-099', name: 'Vencimento', value: dataVencimento, description: 'Data de Vencimento (DDMMAAAA)' },
        { pos: '100-114', name: 'Valor Título', value: `R$ ${(boleto.valor).toFixed(2)}`, description: 'Valor em Centavos' },
        { pos: '145-152', name: 'Data Pagamento', value: dataPagamento, description: 'Data do Agendamento' },
        { pos: '183-202', name: 'Seu Número', value: seuNumero.trim(), description: 'Identificação Interna' },
      ],
    });

    // SEGMENTO J-52 (Opcional/Obrigatório: Identificação do Favorecido e Pagador Avalista)
    sequencialRegistroNoLote += 1;
    const seqJ52Str = padLeftZeros(sequencialRegistroNoLote, 5);

    const docFavorecidoClean = onlyNumbers(boleto.favorecidoCnpjCpf || '00000000000000');
    const tipoInscricaoFavorecido = docFavorecidoClean.length > 11 ? '2' : '1';

    const segmentoJ52Parts = [
      bancoCodigo,                           // 001-003 (3) Banco
      loteServico,                           // 004-007 (4) Lote
      '3',                                   // 008-008 (1) Tipo de registro = 3
      seqJ52Str,                             // 009-013 (5) Sequencial
      'J',                                   // 014-014 (1) Segmento J
      '   ',                                 // 015-017 (3) Reservado
      '52',                                  // 018-019 (2) Código Registro Opcional J-52
      tipoInscricaoCompany,                  // 020-020 (1) Tipo Inscrição Sacado (Empresa Pagadora)
      inscricaoCompany,                      // 021-035 (15) CNPJ/CPF Sacado Pagador
      empresaNome.padEnd(40, ' ').substring(0, 40), // 036-075 (40) Nome Sacado Pagador
      tipoInscricaoFavorecido,               // 076-076 (1) Tipo Inscrição Beneficiário
      padLeftZeros(docFavorecidoClean, 15),  // 077-091 (15) CNPJ/CPF Beneficiário
      favorecidoNome.padEnd(40, ' ').substring(0, 40), // 092-131 (40) Nome Beneficiário
      '0',                                   // 132-132 (1) Tipo Inscrição Sacador Avalista
      padLeftZeros('0', 15),                 // 133-147 (15) CNPJ/CPF Sacador Avalista
      padRightSpaces('', 40),                // 148-187 (40) Nome Sacador Avalista
      padRightSpaces('', 53),                // 188-240 (53) Reservado FEBRABAN
    ];

    const linhaSegmentoJ52 = segmentoJ52Parts.join('');
    lines.push(linhaSegmentoJ52);

    highlights.push({
      type: 'SEGMENTO_J52',
      lineNumber: lines.length,
      content: linhaSegmentoJ52,
      description: `Segmento J-52 (Detalhamento Favorecido #${idx + 1})`,
      fields: [
        { pos: '021-035', name: 'CNPJ Pagador', value: inscricaoCompany, description: 'Pagador da Conta' },
        { pos: '077-091', name: 'Doc Beneficiário', value: padLeftZeros(docFavorecidoClean, 15), description: 'CPF/CNPJ Recebedor' },
        { pos: '092-131', name: 'Nome Beneficiário', value: favorecidoNome.trim(), description: 'Nome do Recebedor' },
      ],
    });
  });

  // 4. TRAILER DE LOTE (Tipo Registro 5)
  // Total de registros no lote = Header de Lote (1) + Detalhes (2 por boleto) + Trailer de Lote (1)
  const qtdRegistrosLote = 1 + (boletos.length * 2) + 1;
  const qtdRegistrosLoteStr = padLeftZeros(qtdRegistrosLote, 6);
  const somatorioValores = formatValueCNAB(totalValorBoletos, 18);

  const trailerLoteParts = [
    bancoCodigo,                           // 001-003 (3) Banco
    loteServico,                           // 004-007 (4) Lote
    '5',                                   // 008-008 (1) Tipo Registro = 5
    padRightSpaces('', 9),                 // 009-017 (9) Reservado FEBRABAN
    qtdRegistrosLoteStr,                   // 018-023 (6) Quantidade Registros Lote
    somatorioValores,                      // 024-041 (18) Somatório Valores Títulos
    padLeftZeros('0', 18),                 // 042-059 (18) Quantidade de Moedas
    padLeftZeros('0', 6),                  // 060-065 (6) N° Aviso de Débito
    padRightSpaces('', 165),               // 066-230 (165) Reservado FEBRABAN
    padRightSpaces('', 10),                // 231-240 (10) Ocorrências
  ];

  const trailerLote = trailerLoteParts.join('');
  lines.push(trailerLote);

  highlights.push({
    type: 'TRAILER_LOTE',
    lineNumber: lines.length,
    content: trailerLote,
    description: 'Trailer de Lote - Totalização do Lote de Pagamentos',
    fields: [
      { pos: '018-023', name: 'Qtd Registros', value: String(qtdRegistrosLote), description: 'Total de linhas do lote' },
      { pos: '024-041', name: 'Valor Total', value: `R$ ${totalValorBoletos.toFixed(2)}`, description: 'Somatório dos valores' },
    ],
  });

  // 5. TRAILER DE ARQUIVO (Tipo Registro 9)
  // Total de registros no arquivo = Header Arq (1) + linhas do lote + Trailer Arq (1)
  const totalLinhasArquivo = lines.length + 1;
  const qtdLotesStr = padLeftZeros(1, 6);
  const qtdRegistrosArqStr = padLeftZeros(totalLinhasArquivo, 6);

  const trailerArquivoParts = [
    bancoCodigo,                           // 001-003 (3) Banco
    '9999',                                // 004-007 (4) Lote = 9999
    '9',                                   // 008-008 (1) Tipo Registro = 9
    padRightSpaces('', 9),                 // 009-017 (9) Reservado FEBRABAN
    qtdLotesStr,                           // 018-023 (6) Qtd de Lotes
    qtdRegistrosArqStr,                    // 024-029 (6) Qtd de Registros no Arquivo
    padLeftZeros('0', 6),                  // 030-035 (6) Qtd de Contas Conciliação
    padRightSpaces('', 205),               // 036-240 (205) Reservado FEBRABAN
  ];

  const trailerArquivo = trailerArquivoParts.join('');
  lines.push(trailerArquivo);

  highlights.push({
    type: 'TRAILER_ARQUIVO',
    lineNumber: lines.length,
    content: trailerArquivo,
    description: 'Trailer de Arquivo - Totalização final do arquivo CNAB',
    fields: [
      { pos: '018-023', name: 'Qtd Lotes', value: '1', description: 'Número de lotes no arquivo' },
      { pos: '024-029', name: 'Qtd Registros', value: String(totalLinhasArquivo), description: 'Total de linhas do arquivo' },
    ],
  });

  return {
    fileContent: lines.join('\r\n'),
    totalLines: lines.length,
    totalLotes: 1,
    totalBoletos: boletos.length,
    totalValor: totalValorBoletos,
    highlights,
  };
}
