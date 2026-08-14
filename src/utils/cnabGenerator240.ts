import { BoletoItem, CompanySettings, CNABLineHighlight } from '../types';
import { dateToCNAB, onlyNumbers } from './boletoParser.js';

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

  const isSantander = bancoCodigo === '033';

  const convenio = isSantander && company.convenio && company.convenio.length < 20
    ? `0033${padLeftZeros(company.agencia, 4)}${padLeftZeros(company.convenio || company.codigoTransmissao || '0', 12)}`
    : padRightSpaces(company.convenio || '', 20);

  const empresaNome = padRightSpaces(company.razaoSocial, 30);
  const bancoNome = isSantander ? padRightSpaces('Banco Santander', 30) : padRightSpaces(company.bancoNome, 30);
  
  // Santander Pagfor V11.7: Posições 158-163 (NSA - Número Sequencial do Arquivo).
  // Faixa de 1 a 10 (000001 a 000010) é tratada pelo banco exclusivamente como Teste/Homologação.
  // Para seguir em Produção, a sequência deve iniciar obrigatoriamente a partir de 11 em diante (000011, 000012, etc.).
  const nsaRaw = typeof company.nsa === 'number' ? company.nsa : parseInt(String(company.nsa || '11'), 10) || 11;
  const effectiveNsa = (isSantander && nsaRaw < 11) ? 11 : nsaRaw;
  const nsa = padLeftZeros(effectiveNsa, 6);

  // 1. HEADER DE ARQUIVO (Tipo Registro 0)
  const headerArquivoParts = [
    bancoCodigo,                           // 001-003 (3) Banco
    '0000',                                // 004-007 (4) Lote de serviço
    '0',                                   // 008-008 (1) Tipo de registro = 0
    '         ',                           // 009-017 (9) Reservado FEBRABAN / Brancos
    tipoInscricaoCompany,                  // 018-018 (1) Tipo inscrição
    inscricaoCompany,                      // 019-032 (14) CNPJ/CPF Empresa
    convenio,                              // 033-052 (20) Convênio no banco (BBBBAAAACCCCCCCCCCCC p/ Santander)
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
    isSantander ? '060' : '103',           // 164-166 (3) Versão Layout Arquivo ('060' Santander)
    isSantander ? '01600' : '01600',       // 167-171 (5) Densidade Gravação
    padRightSpaces('', 20),                // 172-191 (20) Reservado Banco
    isSantander && (company.codigoEstacao || company.codigoTransmissao)
      ? padRightSpaces((company.codigoEstacao || company.codigoTransmissao || '').trim(), 20)
      : padRightSpaces('', 20),            // 192-211 (20) Reservado Empresa / Código Estação
    padRightSpaces('', 19),                // 212-230 (19) Filler
    padRightSpaces('', 10),                // 231-240 (10) Ocorrências para Retorno
  ];

  const headerArquivo = headerArquivoParts.join('').substring(0, 240).padEnd(240, ' ');
  lines.push(headerArquivo);

  highlights.push({
    type: 'HEADER_ARQUIVO',
    lineNumber: 1,
    content: headerArquivo,
    description: isSantander
      ? 'Header de Arquivo Santander (Versão 060) - Identificação da empresa pagadora'
      : 'Header de Arquivo - Identificação da empresa pagadora e do banco',
    fields: [
      { pos: '001-003', name: 'Banco', value: bancoCodigo, description: 'Código do Banco Pagador (033 = Santander)' },
      { pos: '019-032', name: 'CNPJ/CPF', value: inscricaoCompany, description: 'Documento da Empresa' },
      { pos: '033-052', name: 'Convênio Pagfor', value: convenio.trim(), description: isSantander ? 'Convênio Santander (BBBBAAAACCCCCCCCCCCC)' : 'Código do Convênio' },
      ...(isSantander && (company.codigoEstacao || company.codigoTransmissao)
        ? [{ pos: '192-211', name: 'Cód. Estação', value: (company.codigoEstacao || company.codigoTransmissao || '').trim(), description: 'Código da Estação Santander Pagfor' }]
        : []),
      { pos: '073-102', name: 'Empresa', value: empresaNome.trim(), description: 'Razão Social da Empresa' },
      { pos: '144-151', name: 'Data Geração', value: dataGeracao, description: 'Data do Arquivo' },
      {
        pos: '158-163',
        name: 'NSA (Sequencial)',
        value: nsa,
        description: isSantander
          ? `Número Sequencial do Arquivo (Produção Santander: ${nsa} - Faixa Produção ≥ 11)`
          : `Número Sequencial do Arquivo (NSA #${effectiveNsa})`,
      },
      { pos: '164-166', name: 'Versão Layout', value: isSantander ? '060' : '103', description: 'Versão do Layout do Arquivo' },
    ],
  });

  // 2. HEADER DE LOTE (Tipo Registro 1 - Pagamento de Títulos / Boletos)
  const loteServico = '0001';
  const headerLoteParts = [
    bancoCodigo,                           // 001-003 (3) Banco
    loteServico,                           // 004-007 (4) Lote = 0001
    '1',                                   // 008-008 (1) Tipo de registro = 1
    'C',                                   // 009-009 (1) Operação = C (Crédito)
    isSantander ? '20' : '30',             // 010-011 (2) Serviço (20 = Pagamento Fornecedor Santander)
    '31',                                  // 012-013 (2) Forma Lançamento = 31 (Boletos Outros Bancos/Geral)
    isSantander ? '030' : (company.layoutVersaoLote || '046'), // 014-016 (3) Versão Layout Lote ('030' Santander)
    ' ',                                   // 017-017 (1) Reservado FEBRABAN / Branco
    tipoInscricaoCompany,                  // 018-018 (1) Tipo inscrição
    inscricaoCompany,                      // 019-032 (14) CNPJ/CPF Empresa
    convenio,                              // 033-052 (20) Convênio
    agencia,                               // 053-057 (5) Agência
    agenciaDV,                             // 058-058 (1) DV Agência
    conta,                                 // 059-070 (12) Conta Corrente
    contaDV,                               // 071-071 (1) DV Conta
    agenciaContaDV,                        // 072-072 (1) DV Ag/Conta
    empresaNome,                           // 073-102 (30) Nome da Empresa
    padRightSpaces('PAGAMENTO A FORNECEDORES', 40), // 103-142 (40) Mensagem
    padRightSpaces(company.logradouro || 'RUA PRINCIPAL', 30), // 143-172 (30) Logradouro
    padLeftZeros(company.numero || '100', 5), // 173-177 (5) Número
    padRightSpaces(company.complemento || '', 15), // 178-192 (15) Complemento
    padRightSpaces(company.cidade || 'SAO PAULO', 20), // 193-212 (20) Cidade
    padLeftZeros(company.cep?.substring(0, 5) || '01000', 5), // 213-217 (5) CEP
    padLeftZeros(company.cep?.substring(5) || '000', 3), // 218-220 (3) Complemento CEP
    padRightSpaces(company.uf || 'SP', 2), // 221-222 (2) UF
    padRightSpaces('', 8),                 // 223-230 (8) Indicativo Forma Pagamento
    padRightSpaces('', 10),                // 231-240 (10) Ocorrências para o Retorno
  ];

  const headerLote = headerLoteParts.join('').substring(0, 240).padEnd(240, ' ');
  lines.push(headerLote);

  highlights.push({
    type: 'HEADER_LOTE',
    lineNumber: 2,
    content: headerLote,
    description: isSantander
      ? 'Header de Lote Santander (Versão Lote 030 - Serviço 20 Pagamento Fornecedor)'
      : 'Header de Lote - Especifica o tipo de lote (Pagamento de Títulos/Boletos)',
    fields: [
      { pos: '004-007', name: 'Lote', value: loteServico, description: 'Número do Lote' },
      { pos: '010-011', name: 'Serviço', value: isSantander ? '20' : '30', description: isSantander ? 'Pagamento a Fornecedores (Santander)' : 'Pagamento de Títulos/Boletos' },
      { pos: '014-016', name: 'Versão Lote', value: isSantander ? '030' : (company.layoutVersaoLote || '046'), description: 'Versão do Layout do Lote' },
      { pos: '073-102', name: 'Empresa', value: empresaNome.trim(), description: 'Razão Social' },
      { pos: '143-222', name: 'Endereço', value: `${company.cidade}/${company.uf}`, description: 'Localização da Empresa' },
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
      '0',                                   // 015-015 (1) Tipo de Movimento = 0 (Inclusão)
      '00',                                  // 016-017 (2) Código Instrução Movimento = 00 (Liberado)
      codigoBarras,                          // 018-061 (44) Código de Barras
      favorecidoNome,                        // 062-091 (30) Nome do Favorecido/Beneficiário
      dataVencimento,                        // 092-099 (8) Data de Vencimento
      valorTitulo,                           // 100-114 (15) Valor do Título
      valorDesconto,                         // 115-129 (15) Valor do Desconto
      valorJurosMulta,                       // 130-144 (15) Valor Juros/Multa
      dataPagamento,                         // 145-152 (8) Data do Pagamento
      valorPagamento,                        // 153-167 (15) Valor do Pagamento Efetivo
      padLeftZeros('0', 15),                 // 168-182 (15) Quantidade Moeda (Zeros)
      seuNumero,                             // 183-202 (20) Seu Número / Ref Empresa
      nossoNumero,                           // 203-222 (20) Nosso Número / Ref Banco
      '09',                                  // 223-224 (2) Código da Moeda (09 = Real)
      padRightSpaces('', 6),                 // 225-230 (6) Filler
      padRightSpaces('', 10),                // 231-240 (10) Ocorrências para Retorno
    ];

    const linhaSegmentoJ = segmentoJParts.join('').substring(0, 240).padEnd(240, ' ');
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

    // SEGMENTO J-52 (Obrigatório Santander / Febraban: Identificação do Favorecido e Pagador)
    sequencialRegistroNoLote += 1;
    const seqJ52Str = padLeftZeros(sequencialRegistroNoLote, 5);

    // Determine Beneficiary / Favorecido document and type (Mandatory for Santander J-52)
    const rawFavorecidoDoc = boleto.favorecidoCnpjCpf || boleto.beneficiarioCnpjCpf || '';
    const docFavorecidoClean = onlyNumbers(rawFavorecidoDoc);
    
    // Tipo de Inscrição Beneficiário (Posição 76): 1=CPF, 2=CNPJ, 3=PIS/PASEP
    let tipoInscricaoFavorecido = '2'; // Default to CNPJ for companies
    if (docFavorecidoClean.length > 0 && docFavorecidoClean.length <= 11) {
      tipoInscricaoFavorecido = '1'; // CPF
    } else if (docFavorecidoClean.length > 11) {
      tipoInscricaoFavorecido = '2'; // CNPJ
    }

    // Determine Pagador document and type
    const rawPagadorDoc = boleto.pagadorCnpjCpf || company.cnpjCpf || '';
    const docPagadorClean = onlyNumbers(rawPagadorDoc);
    let tipoInscricaoPagador = company.tipoInscricao === 'CNPJ' ? '2' : '1';
    if (docPagadorClean.length > 0) {
      tipoInscricaoPagador = docPagadorClean.length > 11 ? '2' : '1';
    }

    const pagadorNome = padRightSpaces(boleto.pagador || company.razaoSocial, 40);
    const beneficiarioNome = padRightSpaces(boleto.favorecidoNome || boleto.beneficiario || 'BENEFICIARIO DO BOLETO', 40);

    const segmentoJ52Parts = [
      bancoCodigo,                                  // 001-003 (3) Banco (033 = Santander)
      loteServico,                                  // 004-007 (4) Lote de Serviço = 0001
      '3',                                          // 008-008 (1) Tipo de registro = 3 (Detalhe)
      seqJ52Str,                                    // 009-013 (5) Sequencial no Lote
      'J',                                          // 014-014 (1) Segmento = J
      ' ',                                          // 015-015 (1) Filler / Reservado FEBRABAN
      '00',                                         // 016-017 (2) Código de Movimento / Remessa = 00
      '52',                                         // 018-019 (2) Identificação Registro Opcional J-52
      tipoInscricaoPagador,                         // 020-020 (1) Tipo Inscrição Pagador (1=CPF, 2=CNPJ)
      padLeftZeros(docPagadorClean || inscricaoCompany, 15), // 021-035 (15) CNPJ/CPF Pagador (15 dígitos com zeros)
      pagadorNome,                                  // 036-075 (40) Nome do Pagador
      tipoInscricaoFavorecido,                      // 076-076 (1) Tipo Inscrição Beneficiário (1=CPF, 2=CNPJ) - Santander V11.7
      padLeftZeros(docFavorecidoClean, 15),         // 077-091 (15) CNPJ/CPF Beneficiário (15 dígitos com zeros) - Santander V11.7
      beneficiarioNome,                             // 092-131 (40) Nome do Beneficiário
      '0',                                          // 132-132 (1) Tipo Inscrição Sacador Avalista (0=Isento/Não informado)
      padLeftZeros('0', 15),                        // 133-147 (15) CNPJ/CPF Sacador Avalista (15 zeros)
      padRightSpaces('', 40),                       // 148-187 (40) Nome Sacador Avalista (40 espaços)
      padRightSpaces('', 53),                       // 188-240 (53) Reservado Santander / FEBRABAN (53 espaços)
    ];

    const linhaSegmentoJ52 = segmentoJ52Parts.join('').substring(0, 240).padEnd(240, ' ');
    lines.push(linhaSegmentoJ52);

    const isBeneficiaryDocMissing = !docFavorecidoClean || docFavorecidoClean === '00000000000000' || docFavorecidoClean === '0';

    highlights.push({
      type: 'SEGMENTO_J52',
      lineNumber: lines.length,
      content: linhaSegmentoJ52,
      description: isSantander
        ? `Segmento J-52 Santander V11.7 (Obrigatório - Beneficiário: ${boleto.favorecidoNome || 'Cedente'})`
        : `Segmento J-52 (Identificação do Beneficiário e Pagador #${idx + 1})`,
      fields: [
        { pos: '018-019', name: 'Reg Opcional', value: '52', description: 'Identificação Segmento J-52' },
        { pos: '020-020', name: 'Tipo Insc. Pagador', value: tipoInscricaoPagador, description: tipoInscricaoPagador === '2' ? '2 = CNPJ Pagador' : '1 = CPF Pagador' },
        { pos: '021-035', name: 'CNPJ Pagador', value: padLeftZeros(docPagadorClean || inscricaoCompany, 15), description: 'CNPJ/CPF do Pagador/Sacado' },
        { pos: '036-075', name: 'Nome Pagador', value: pagadorNome.trim(), description: 'Razão Social do Pagador' },
        { pos: '076-076', name: 'Tipo Insc. Beneficiário', value: tipoInscricaoFavorecido, description: tipoInscricaoFavorecido === '2' ? '2 = CNPJ Beneficiário' : '1 = CPF Beneficiário' },
        {
          pos: '077-091',
          name: 'Doc Beneficiário',
          value: padLeftZeros(docFavorecidoClean, 15),
          description: isBeneficiaryDocMissing
            ? '⚠️ ATENÇÃO: CNPJ/CPF do Beneficiário ausente! O Santander rejeitará com ocorrência AT.'
            : 'CPF/CNPJ Real do Beneficiário (Obrigatório Santander)',
        },
        { pos: '092-131', name: 'Nome Beneficiário', value: beneficiarioNome.trim(), description: 'Razão Social do Favorecido/Recebedor' },
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
    padRightSpaces('', 10),                // 231-240 (10) Ocorrências para Retorno
  ];

  const trailerLote = trailerLoteParts.join('').substring(0, 240).padEnd(240, ' ');
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
    padRightSpaces('', 211),               // 030-240 (211) Filler / Reservado
  ];

  const trailerArquivo = trailerArquivoParts.join('').substring(0, 240).padEnd(240, ' ');
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
