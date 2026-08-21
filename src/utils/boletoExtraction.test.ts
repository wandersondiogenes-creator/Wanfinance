import { parseExtractedValor, parseLinhaDigitavel, detectBoletoDetailsFromText } from './boletoParser';
import { validateAndCrossCheckBoleto } from './boletoExtractorEngine';

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

export function runAllBoletoTests(): { results: TestResult[]; total: number; passedCount: number; failedCount: number } {
  const results: TestResult[] = [];

  function assert(suite: string, testName: string, actual: any, expected: any) {
    const isNum = typeof actual === 'number' && typeof expected === 'number';
    const passed = isNum ? Math.abs(actual - expected) < 0.0001 : JSON.stringify(actual) === JSON.stringify(expected);
    results.push({
      suite,
      testName,
      passed,
      expected,
      actual,
      error: passed ? undefined : `Esperado: ${JSON.stringify(expected)}, Obtido: ${JSON.stringify(actual)}`,
    });
  }

  // ==========================================
  // SUÍTE 1: Conversão e Formatação de Moeda
  // ==========================================
  assert('Conversão de Valores', 'Extração R$189,50', parseExtractedValor('R$189,50'), 189.5);
  assert('Conversão de Valores', 'Extração R$ 189,50 com espaço', parseExtractedValor('R$ 189,50'), 189.5);
  assert('Conversão de Valores', 'Extração 189,50 sem símbolo', parseExtractedValor('189,50'), 189.5);

  assert('Conversão de Valores', 'Extração R$1.895,40', parseExtractedValor('R$1.895,40'), 1895.4);
  assert('Conversão de Valores', 'Extração R$ 1.895,40 com espaço', parseExtractedValor('R$ 1.895,40'), 1895.4);
  assert('Conversão de Valores', 'Extração 1.895,40 sem símbolo', parseExtractedValor('1.895,40'), 1895.4);

  assert('Conversão de Valores', 'Extração R$18.954,00', parseExtractedValor('R$18.954,00'), 18954.0);
  assert('Conversão de Valores', 'Extração R$ 18.954,00 com espaço', parseExtractedValor('R$ 18.954,00'), 18954.0);
  assert('Conversão de Valores', 'Extração 18.954,00 sem símbolo', parseExtractedValor('18.954,00'), 18954.0);

  assert('Conversão de Valores', 'Extração R$ 118.267,52 (Centena de Milhar)', parseExtractedValor('R$ 118.267,52'), 118267.52);
  assert('Conversão de Valores', 'Extração R$118.267,52 colado', parseExtractedValor('R$118.267,52'), 118267.52);
  assert('Conversão de Valores', 'Extração 118.267,52 sem símbolo', parseExtractedValor('118.267,52'), 118267.52);
  assert('Conversão de Valores', 'Extração 118267.52 formato float', parseExtractedValor('118267.52'), 118267.52);
  assert('Conversão de Valores', 'Extração 118267.52 tipo numérico', parseExtractedValor(118267.52), 118267.52);

  // ==========================================
  // SUÍTE 2: Boleto Santander (NF 1764531 / FIDC Renault)
  // ==========================================
  const linhaSantander = '03399.42294 96710.000017 99832.901013 7 15440011826752';
  const parsedSantander = parseLinhaDigitavel(linhaSantander);

  assert('Boleto Santander', 'Linha Digitável Válida', parsedSantander.isValid, true);
  assert('Boleto Santander', 'Código do Banco 033', parsedSantander.bancoCodigo, '033');
  assert('Boleto Santander', 'Nome do Banco Santander', parsedSantander.bancoNome, 'Santander');
  assert('Boleto Santander', 'Valor Extraído da Linha R$ 118.267,52', parsedSantander.valor, 118267.52);
  assert('Boleto Santander', 'Data de Vencimento 2026-08-20', parsedSantander.dataVencimento, '2026-08-20');
  assert(
    'Boleto Santander',
    'Código de Barras 44 dígitos',
    parsedSantander.codigoBarras,
    '03397154400118267529422996710000019983290101'
  );

  // Simulação de OCR do Boleto Santander
  const ocrTextSantander = `
Santander | 033-7 | 03399.42294 96710.000017 99832.901013 7 15440011826752
Beneficiário
VENDA DE VEICULOS FUNDO DE INVESTIMENTO
Beneficiário Endereço / Sacador Avalista: -
Avenida em São Paulo, 12345, Centro - São Paulo/SP - CEP: 01234-567
Número do documento CPF/CNPJ Vencimento Valor documento
100000199832 21126275000146 20/08/2026 R$ 118.267,52
(-) Desconto / Abatimentos (-) Outras deduções (+) Mora / Multa (+) Outros acréscimos (=) Valor cobrado
Pagador
EUROVIA VEICULOS S.A. CNPJ: 02.671.595/0005-66
AV ANTONIO CARLOS MAGALH 4925, BL A 4925
IGUATEMI - SALVADOR/BA - CEP: 40280-000
Instruções
Não Pagar com Cheque.
Não receber após o vencimento.
Boleto válido para pagamento no dia da emissão.
Crédito devido pela Concessionária a montadora Renault decorrente da aquisição de veículos a prazo que integre os valores cobrados por meio deste boleto o qual foi cedido ao FIDC VENDA DE VEICULOS FUNDO DE INVESTIMENTO EM DIREITOS CREDITÓRIOS no vencimento da nota fiscal.
Corte na linha pontilhada
Santander | 033-7 | 03399.42294 96710.000017 99832.901013 7 15440011826752
Local de pagamento
Pagável em qualquer Banco até o vencimento
Beneficiário
VENDA DE VEICULOS FUNDO DE INVESTIMENTO 21.126.275/0001-46 Avenida em São Paulo, 12345, Centro - São Paulo/SP - CEP: 01234-567
Data do documento Nº documento Espécie doc. Aceite Data processamento Nosso número
20/08/2026 100000199832 RC N 20/08/2026 100000199832-9
Uso do banco Carteira Espécie Quantidade (x) Valor (=) Valor documento
101 - RCR R$ R$ 118.267,52
`;

  const detectedSantander = detectBoletoDetailsFromText(ocrTextSantander, 'Santander');
  assert('OCR Boleto Santander', 'Beneficiário Detectado', detectedSantander.favorecidoNome, 'VENDA DE VEICULOS FUNDO DE INVESTIMENTO');
  assert('OCR Boleto Santander', 'CNPJ Beneficiário', detectedSantander.favorecidoCnpjCpf, '21.126.275/0001-46');
  assert('OCR Boleto Santander', 'Pagador Detectado', detectedSantander.pagador, 'EUROVIA VEICULOS S.A.');
  assert('OCR Boleto Santander', 'CNPJ Pagador', detectedSantander.pagadorCnpjCpf, '02.671.595/0005-66');
  assert('OCR Boleto Santander', 'Valor Extraído do Texto', detectedSantander.valor, 118267.52);
  assert('OCR Boleto Santander', 'Data Vencimento do Texto', detectedSantander.dataVencimento, '2026-08-20');
  assert('OCR Boleto Santander', 'Número Documento', detectedSantander.seuNumero, '100000199832');
  assert('OCR Boleto Santander', 'Nosso Número', detectedSantander.nossoNumero, '100000199832-9');

  // Validação Cruzada (Cross-check)
  const crossChecked = validateAndCrossCheckBoleto({
    linhaDigitavel: linhaSantander,
    beneficiario: detectedSantander.favorecidoNome,
    beneficiarioCnpjCpf: detectedSantander.favorecidoCnpjCpf,
    pagador: detectedSantander.pagador,
    pagadorCnpjCpf: detectedSantander.pagadorCnpjCpf,
    valor: detectedSantander.valor,
    dataVencimento: detectedSantander.dataVencimento,
    numeroDocumento: detectedSantander.seuNumero,
    nossoNumero: detectedSantander.nossoNumero,
    bancoCodigo: detectedSantander.bancoCodigo,
    bancoNome: detectedSantander.bancoNome,
  });

  assert('Cross-Check Santander', 'Valor Final Validado', crossChecked.valor, 118267.52);
  assert('Cross-Check Santander', 'Vencimento Final Validado', crossChecked.dataVencimento, '2026-08-20');
  assert('Cross-Check Santander', 'Confiança 100%', crossChecked.confianca >= 90, true);
  assert('Cross-Check Santander', 'Zero Divergências Críticas', crossChecked.camposDivergentes.length, 0);

  // ==========================================
  // SUÍTE 3: FIDC Complementar Auto Ford (Bradesco)
  // ==========================================
  const linhaFord = '23792.85634 06923.179516 59003.852403 5 15430000486840';
  const parsedFord = parseLinhaDigitavel(linhaFord);
  assert('FIDC Ford', 'Linha Válida Bradesco', parsedFord.isValid, true);
  assert('FIDC Ford', 'Código Banco 237', parsedFord.bancoCodigo, '237');
  assert('FIDC Ford', 'Valor R$ 4.868,40', parsedFord.valor, 4868.4);
  assert('FIDC Ford', 'Vencimento 2026-08-19', parsedFord.dataVencimento, '2026-08-19');

  // ==========================================
  // SUÍTE 4: Banco Fidis (Bradesco)
  // ==========================================
  const linhaFidis = '23792.01102 90000.000004 00000.000000 1 15450002500000';
  const parsedFidis = parseLinhaDigitavel(linhaFidis);
  assert('Banco Fidis', 'Linha Válida Bradesco', parsedFidis.isValid, true);
  assert('Banco Fidis', 'Código Banco 237', parsedFidis.bancoCodigo, '237');
  assert('Banco Fidis', 'Valor R$ 25.000,00', parsedFidis.valor, 25000.0);
  assert('Banco Fidis', 'Vencimento 2026-08-21', parsedFidis.dataVencimento, '2026-08-21');

  // ==========================================
  // SUÍTE 5: Concessionária / Tributo 48 dígitos
  // ==========================================
  const linhaConcessionaria = '85890000001 2 12345678901 3 23456789012 4 34567890123 5';
  const parsedConcessionaria = parseLinhaDigitavel(linhaConcessionaria);
  assert('Concessionária 48 dígitos', 'Identificado como Concessionária', parsedConcessionaria.tipo, 'concessionaria');
  assert('Concessionária 48 dígitos', 'Valor 48 dígitos parse', typeof parsedConcessionaria.valor === 'number', true);

  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  return { results, total, passedCount, failedCount };
}

// Se executado diretamente via CLI/tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('boletoExtraction.test')) {
  console.log('Executando bateria completa de testes de extração de boletos...\n');
  const { results, total, passedCount, failedCount } = runAllBoletoTests();

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} [${r.suite}] ${r.testName}: ${r.passed ? 'OK' : r.error}`);
  }

  console.log(`\n========================================`);
  console.log(`TOTAL: ${total} | PASSOU: ${passedCount} | FALHOU: ${failedCount}`);
  console.log(`STATUS: ${failedCount === 0 ? 'TODOS OS TESTES PASSARAM COM SUCESSO! 🎉' : 'HOUVE FALHAS.'}`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}
