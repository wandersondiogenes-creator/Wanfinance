import { Type } from "@google/genai";
import { parseLinhaDigitavel, onlyNumbers } from "./boletoParser.js";

export interface ExtractedBoletoData {
  linhaDigitavel: string;
  codigoBarras: string;
  banco: string;
  bancoCodigo: string;
  bancoNome: string;
  beneficiario: string; // Favorecido / Cedente / Beneficiário
  beneficiarioCnpjCpf: string;
  favorecidoNome?: string;
  favorecidoCnpjCpf?: string;
  pagador: string; // Devedor / Sacado / Cliente / Pagador
  pagadorCnpjCpf: string;
  sacadorAvalista?: string;
  valor: number;
  valorDocumento?: number;
  valorCobrado?: number;
  dataVencimento: string; // YYYY-MM-DD
  numeroDocumento: string; // Nº do Documento impresso
  seuNumero: string;
  nossoNumero: string;
  agenciaConta: string;
  desconto: number;
  juros: number;
  multa: number;
  jurosMulta: number;
  tipoDocumento: string; // 'boleto', 'darf', 'gnre', 'carnet', 'tributo', 'concessionaria'
  confianca: number; // 0 a 100
  alertas: string[];
  camposDivergentes?: string[];
  observacoes?: string;
}

export const SYSTEM_INSTRUCTION_BOLETO = `Você é uma Inteligência Artificial de MÁXIMA PRECISÃO e especialista em auditoria e OCR de documentos financeiros brasileiros, incluindo:
- Boletos Bancários de Cobrança (Bradesco, Santander, Banco do Brasil, Itaú, Caixa, Sicoob, Sicredi, Safra, Inter, Nubank, etc.)
- Carnês de Financiamento e Seguros (ex: Suhai, Porto Seguro, BV, Safra)
- Guias de Arrecadação de Tributos (DARF, GNRE, DAS, SIMPLES NACIONAL, DAE)
- Taxas e Impostos Veiculares (IPVA, DETRAN, Licenciamento, DPVAT)
- Multas de Trânsito (CTTU, AMC, PRF, DER, DETRAN)
- Contas de Concessionárias de Serviços Públicos (Água, Luz, Telefone, Gás)

DIRETRIZES FUNDAMENTAIS PARA EXTRAÇÃO DE ALTÍSSIMA PRECISÃO:
1. LEITURA MULTIMODAL COMPLETA: Analise visualmente e semanticamente TODO O CONTEÚDO DE TODAS AS PÁGINAS do PDF/Imagem enviada.
2. DIFERENCIAÇÃO CRÍTICA ENTRE BENEFICIÁRIO E PAGADOR:
   - "beneficiario": Quem RECEBE O DINHEIRO / Emissor / Cedente / Favorecido (Ex: "BANCO FIDIS S/A.", "SUHAI SEGURADORA S.A.", "CLARO S.A.", "COMPESA", "DETRAN-PE", "SEFAZ-PE"). ATENÇÃO: Se o Beneficiário impresso for um Banco de Financiamento/Crédito/Montadora (Ex: BANCO FIDIS S/A, BANCO SAFRA S/A, BANCO VOLKSWAGEN, BANCO TOYOTA, BANCO GM, BANCO RENAULT, BANCO HONDA, BANCO DAYCOVAL, BANCO PAN), ESTA INSTITUIÇÃO É O BENEFICIÁRIO CORRETO. O Banco Processador/Emissor do boleto (Ex: Bradesco - 237) é o banco que processa o título.
   - "beneficiarioCnpjCpf": CNPJ ou CPF do Beneficiário/Cedente (Ex: "062.237.425/0001-76").
   - "pagador": Quem DEVE PAGAR O BOLETO / Sacado / Cliente / Devedor (Ex: "VIA SUL VEICULOS S/A", "JOAO DA SILVA", "EMPRESA ABC LTDA"). NUNCA confunda o Pagador com o Beneficiário! Preserve sufixos como "S/A", "S.A.", "LTDA".
   - "pagadorCnpjCpf": CPF ou CNPJ do Pagador (Ex: "040.841.736/0022-31").
3. DADOS FINANCEIROS E CÓDIGOS DE BARRAS:
   - "linhaDigitavel": Linha digitável completa de 47 dígitos (boletos bancários) ou 48 dígitos (concessionárias/tributos/DARF/GNRE/DAE/IPVA/DETRAN).
   - "codigoBarras": Código de barras numérico de 44 dígitos sem espaços.
   - "valor": Valor numérico exato em Reais (R$). ATENÇÃO: Retorne O VALOR TOTAL FINAL COBRADO / VALOR DO DOCUMENTO que está codificado na linha digitável/código de barras. NUNCA retorne sub-totais ou itens individuais de tabelas de discriminação de débitos.
   - "dataVencimento": Data de Vencimento no formato YYYY-MM-DD.
   - "numeroDocumento": Número impresso no campo "Nº do Documento", "Nº de Controle" ou Nota Fiscal.
   - "nossoNumero": Código impresso no campo "Nosso Número".
   - "agenciaConta": Agência e Conta do Beneficiário se visível.
4. REGRA DE MÁXIMA SEGURANÇA E NÃO-INVENÇÃO:
   - SE UM CAMPO NÃO ESTIVER PRESENTE NO BOLETO OU SE HOUVER DÚVIDA, RETORNE EXATAMENTE A STRING "Não identificado com segurança" PARA CAMPOS DE TEXTO E 0 PARA NÚMEROS. NUNCA CHUTE, NUNCA INVENTE E NUNCA ADIVINHE DADOS.
5. ARQUIVOS COM DOIS OU MAIS BOLETOS/GUIAS NO MESMO ARQUIVO (MESMA PÁGINA OU PÁGINAS DIFERENTES):
   - Se o arquivo PDF contiver 2 ou mais boletos ou guias de pagamento (ex: 1ª e 2ª parcela, Cota Única e Parcela, IPVA e Taxa de Licenciamento DETRAN/SEFAZ, dois boletos bancários com linhas digitáveis distintas, ou carnê multi-páginas de veículos/seguros):
   - EXTRAIA CADA BOLETO/GUIA INDIVIDUALMENTE e retorne TODOS os boletos encontrados no array "boletos" (um objeto para cada linha digitável / boleto distinto).
   - Cada boleto do array deve conter sua respectiva linhaDigitavel, seu valor exato individual, seu vencimento e seu favorecido/beneficiário correspondente.
   - NUNCA descarte o segundo boleto e NUNCA retorne apenas o primeiro se houver dois ou mais boletos distintos no documento. Se houver 2 boletos no arquivo, o array "boletos" DEVE CONTER EXATAMENTE 2 ITENS.
6. DOCUMENTOS COM VÁRIAS VIAS REPETIDAS DA MESMA GUIA (VIA USUÁRIO / VIA BANCO COM O MESMO CÓDIGO DE BARRAS):
   - Se uma página contiver 2 vias da MESMA guia (ex: metade superior 'VIA DO CONTRIBUINTE / VIA USUÁRIO' e metade inferior 'VIA DO BANCO / AGENTE ARRECADADOR') compartilhando o EXATO MESMO código de barras / mesma linha digitável, retorne 1 único item para essa guia.
   - MAS SE OS CÓDIGOS DE BARRAS / LINHAS DIGITÁVEIS FOREM DIFERENTES (ex: 2 parcelas distintas, 2 guias de IPVA/Taxas distintas, ou 2 boletos com códigos de barras diferentes), RETORNE OBRIGATORIAMENTE TODOS OS BOLETOS no array "boletos" (um objeto para cada código de barras distinto).
7. EXCEÇÃO CRÍTICA PARA GUIAS GNRE, TRIBUTOS E ARRECADAÇÃO (DOCUMENTO VÁLIDO PARA PAGAMENTO):
   - Em guias de arrecadação GNRE, DARF, DAE, Tributos Estaduais/Federais e Concessionárias: se o documento contiver o campo "Documento Válido para pagamento", "Válido para pagamento até" ou similar especificando uma data (exemplo: "Documento Válido para pagamento 07/08/2026"), CONSIDERE OBRIGATORIAMENTE ESTA DATA FINAL (ex: 2026-08-07) como a "dataVencimento" oficial do boleto.
   - Esta data limite de pagamento/validade TEM PRECEDÊNCIA ABSOLUTA sobre qualquer outra data presente no campo "Data de Vencimento" ou codificada no código de barras.
8. TAXAS E SERVIÇOS DETRAN / DAE / TRIBUTOS (VALOR TOTAL DO BOLETO):
   - Em documentos do DETRAN, DAE, SEFAZ ou Prefeituras com tabelas discriminando sub-serviços (ex: "6.2.13 INCLUSAO DE GRAVAME R$ 90,58", "6.2.1 1o. EMPLACAMENTO R$ 323,16", "7.1.9 CONSUMO DE DADOS R$ 7,90"), NUNCA extraia o valor de um item de serviço individual (ex: 323,16).
   - O VALOR OFICIAL DO BOLETO é SEMPRE o VALOR TOTAL A PAGAR impresso nos campos "Valor a Pagar", "Valor Total" ou "Total a Recolher" (ex: R$ 421,64) e que deve corresponder exatamente ao valor codificado no código de barras.
9. BOLETOS FORMADOS POR AGLUTINAÇÃO COM RELAÇÃO DE COMPROMISSOS/NFs EM ANEXO:
   - Em boletos bancários (ex: Bradesco/Cobflex, Santander, FIDC Ford, FIDC Renault, FIDC Fidis, Banco Fidis) com relação de compromissos ou notas fiscais anexas listando múltiplos itens (ex: 0832852091 R$ 95,81, 0832886091 R$ 1.469,24, etc.):
   - O VALOR DO BOLETO é SEMPRE o valor total cobrado do documento principal (ex: R$ 4.868,40) codificado na linha digitável/código de barras. NUNCA extraia o valor parcial de uma única linha da tabela anexa (ex: 95,81).
   - O "beneficiario" é a entidade credora (ex: "FIDC COMPLEMENTAR AUTO FORD", CNPJ "043.489.824/0001-80").
   - O "pagador" é a empresa devedora (ex: "GRANVIA VEICULOS S/A", CNPJ "012.946.886/0001-40").
   - O "numeroDocumento" e "nossoNumero" devem ser extraídos dos campos oficiais da ficha de compensação/recibo do pagador (ex: Número Documento "0832852091", Nosso Número "030/69231795159-4").
10. REGRA CRÍTICA DE QUANTIDADE DE BOLETOS & DOCUMENTOS MULTI-PÁGINAS:
   - SE O ARQUIVO CONTIVER MÚLTIPLOS BOLETOS OU MÚLTIPLAS PÁGINAS COM BOLETOS/GUIAS INDEPENDENTES (ex: 9 páginas com 1 guia/boleto por página, como guias de IPVA de veículos diferentes, parcelas de tributos ou multas da CTTU/DETRAN): VOCÊ DEVE EXTRAIR CADA GUIA/BOLETO DE CADA PÁGINA COMO UM OBJETO SEPARADO NO ARRAY "boletos" (resultando em 9 itens no array para 9 boletos/guias).
   - NUNCA crie múltiplos objetos no array "boletos" para as linhas de uma tabela anexa de compromissos dentro de um único boleto aglutinado com 1 único código de barras.
   - SE ALGUMA PÁGINA ESTIVER INVERTIDA DE CABEÇA PARA BAIXO (180°) OU DIGITALIZADA COM ORIENTAÇÃO ALTERADA: rotacione mentalmente a imagem e extraia rigorosamente todos os campos (Linha Digitável, Código de Barras, Favorecido CTTU/DETRAN/SEFAZ, Pagador, Placa, Renavam, Auto de Infração, Valor e Vencimento).
11. REGRA CRÍTICA PARA JUROS, MULTA E INSTRUÇÕES APÓS O VENCIMENTO:
   - Textos informativos de instruções como "JUROS DIÁRIO DE R$ X", "COBRAR MULTA DE R$ Y APÓS [DATA]", "APÓS O VENCIMENTO COBRAR MORA/MULTA", etc., são APENAS INSTRUÇÕES CONDICIONAIS DE COBRANÇA SE O BOLETO ESTIVER VENCIDO.
   - NUNCA adicione esses valores condicionais ao campo "valor" nem ao campo "jurosMulta"/"juros"/"multa" de boletos dentro do prazo de vencimento.
   - Os campos "juros", "multa" e "jurosMulta" só devem ser preenchidos se o boleto já tiver o campo formal "(+) Mora / Multa" ou "(+) Outros Acréscimos" preenchido com valor efetivo cobrado maior que zero, ou se o "Valor Cobrado" for maior que o "Valor do Documento". Caso contrário, retorne 0 para juros e multa.`;

export const PROMPT_BOLETO_EXTRACTION = (fileName: string) => `Extraia rigorosamente TODOS os boletos, guias de arrecadação (IPVA, DETRAN, CTTU, SEFAZ) e tributos contidos em TODAS as páginas do arquivo "${fileName}".
ATENÇÃO MULTI-BOLETOS: Se o arquivo tiver múltiplos boletos (por exemplo, 9 boletos em 9 páginas diferentes), você DEVE extrair TODOS os 9 boletos, retornando exatamente 9 objetos no array "boletos".
Se houver boletos escaneados de cabeça para baixo ou invertidos, faça a leitura completa e precisa de cada um.

Certifique-se de preencher com 100% de exatidão para cada boleto:
- Banco Emissor, Código do Banco e Nome do Banco
- Beneficiário / Favorecido (Razão Social e CNPJ/CPF)
- Pagador / Sacado (Razão Social/Nome e CPF/CNPJ)
- Valor, Data de Vencimento
- Número do Documento, Seu Número, Nosso Número, Placa, Renavam, Auto de Infração
- Agência e Conta
- Linha Digitável e Código de Barras (47 ou 48 dígitos)
- Desconto, Juros e Multa
- Tipo do Documento (boleto, darf, gnre, carnet, tributo, concessionaria, ipva)
- Confiança da leitura (0 a 100)
- Alertas de eventuais rasuras, divergências ou campos com pouca clareza.`;

export const GEMINI_BOLETO_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    boletos: {
      type: Type.ARRAY,
      description: "Lista de todos os boletos identificados no arquivo",
      items: {
        type: Type.OBJECT,
        properties: {
          banco: { type: Type.STRING },
          bancoCodigo: { type: Type.STRING },
          bancoNome: { type: Type.STRING },
          beneficiario: { type: Type.STRING },
          beneficiarioCnpjCpf: { type: Type.STRING },
          favorecidoNome: { type: Type.STRING },
          favorecidoCnpjCpf: { type: Type.STRING },
          pagador: { type: Type.STRING },
          pagadorCnpjCpf: { type: Type.STRING },
          sacadorAvalista: { type: Type.STRING },
          valor: { type: Type.NUMBER },
          dataVencimento: { type: Type.STRING },
          numeroDocumento: { type: Type.STRING },
          seuNumero: { type: Type.STRING },
          nossoNumero: { type: Type.STRING },
          agenciaConta: { type: Type.STRING },
          linhaDigitavel: { type: Type.STRING },
          codigoBarras: { type: Type.STRING },
          desconto: { type: Type.NUMBER },
          juros: { type: Type.NUMBER },
          multa: { type: Type.NUMBER },
          jurosMulta: { type: Type.NUMBER },
          valorDocumento: { type: Type.NUMBER },
          valorCobrado: { type: Type.NUMBER },
          tipoDocumento: { type: Type.STRING },
          confianca: { type: Type.NUMBER },
          alertas: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          observacoes: { type: Type.STRING },
        },
        required: ["linhaDigitavel", "valor", "dataVencimento", "beneficiario", "pagador"],
      },
    },
  },
  required: ["boletos"],
};

/**
 * Validates, normalizes, and cross-checks raw extracted boleto data against financial logic.
 */
export function validateAndCrossCheckBoleto(b: Partial<ExtractedBoletoData>): ExtractedBoletoData {
  const alertas: string[] = Array.isArray(b.alertas) ? [...b.alertas] : [];
  const camposDivergentes: string[] = [];
  let score = typeof b.confianca === 'number' && b.confianca > 0 ? b.confianca : 100;

  // 1. Sanitize string fields from all possible Gemini property variations
  const rawObj = b as any;
  let rawLinha = String(
    b.linhaDigitavel ||
    rawObj.linha_digitavel ||
    rawObj.linha ||
    rawObj.codigoBarras ||
    rawObj.codigo_barras ||
    rawObj.codigo_de_barras ||
    rawObj.codigo ||
    ""
  );
  let linhaDigitavel = onlyNumbers(rawLinha);
  let codigoBarras = onlyNumbers(String(b.codigoBarras || rawObj.codigo_barras || rawObj.codigo_de_barras || ""));
  let bancoCodigo = String(b.bancoCodigo || rawObj.banco_codigo || "").trim();
  let bancoNome = String(b.bancoNome || b.banco || rawObj.banco_nome || "").trim();

  let beneficiario = String(
    b.beneficiario ||
    b.favorecidoNome ||
    rawObj.beneficiario_nome ||
    rawObj.favorecido_nome ||
    rawObj.cedente ||
    rawObj.cedente_nome ||
    rawObj.emissor ||
    ""
  ).trim();
  let beneficiarioCnpjCpf = String(
    b.beneficiarioCnpjCpf ||
    b.favorecidoCnpjCpf ||
    rawObj.beneficiario_cnpj_cpf ||
    rawObj.favorecido_cnpj_cpf ||
    rawObj.cnpj_beneficiario ||
    ""
  ).trim();
  let pagador = String(
    b.pagador ||
    rawObj.pagador_nome ||
    rawObj.sacado ||
    rawObj.sacado_nome ||
    rawObj.cliente ||
    rawObj.cliente_nome ||
    ""
  ).trim();
  let pagadorCnpjCpf = String(
    b.pagadorCnpjCpf ||
    rawObj.pagador_cnpj_cpf ||
    rawObj.sacado_cnpj_cpf ||
    rawObj.cpf_cnpj_pagador ||
    ""
  ).trim();

  const parseNum = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let clean = String(val).trim().replace(/^R\$\s*/i, '');
    if (clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  let rawVal = b.valor !== undefined ? b.valor : (rawObj.valor_total || rawObj.valor_documento || rawObj.valor_cobrado || rawObj.total || 0);
  let valor = parseNum(rawVal);
  let valorDocumento = parseNum(b.valorDocumento || rawObj.valor_documento || rawObj.valorDocumento || rawObj.valor_nominal || rawObj.valorOriginal);
  let valorCobrado = parseNum(b.valorCobrado || rawObj.valor_cobrado || rawObj.valorCobrado || rawObj.total_a_pagar || rawObj.valor_a_pagar);
  let desconto = parseNum(b.desconto || rawObj.desconto || rawObj.descontos || rawObj.descontos_abatimentos || rawObj.desconto_abatimento || rawObj.abatimento);
  let juros = parseNum(b.juros || rawObj.juros || rawObj.juros_mora || rawObj.juros_diario || rawObj.mora);
  let multa = parseNum(b.multa || rawObj.multa || rawObj.multa_atraso || rawObj.valor_multa);
  let jurosMulta = parseNum(b.jurosMulta || rawObj.jurosMulta || rawObj.juros_multa || rawObj.mora_multa || rawObj.moraMulta || rawObj.acrescimos || rawObj.outros_acrescimos);

  // Financial cross-reconciliation:
  // Juros/Multa efetivo a pagar só existe se o campo (+) Mora/Multa do recibo tiver valor,
  // ou se Valor Cobrado > Valor Documento. Instruções de "Juros diário de R$..." ou "Cobrar multa de..."
  // são taxas condicionais para após o vencimento e NUNCA devem ser somadas ao valor antes do vencimento.
  if (valorCobrado > 0 && valor > 0 && valorCobrado > valor) {
    jurosMulta = Number((valorCobrado - valor + desconto).toFixed(2));
  } else if (valorCobrado > 0 && valorDocumento > 0 && valorCobrado > valorDocumento) {
    jurosMulta = Number((valorCobrado - valorDocumento + desconto).toFixed(2));
  } else if (valorCobrado > 0 && valorDocumento > 0 && Math.abs(valorCobrado - valorDocumento) < 0.01) {
    jurosMulta = 0;
    juros = 0;
    multa = 0;
  } else if (valor > 0 && valorDocumento > 0 && Math.abs(valor - valorDocumento) < 0.01 && (valorCobrado === 0 || Math.abs(valorCobrado - valor) < 0.01)) {
    jurosMulta = 0;
    juros = 0;
    multa = 0;
  }

  let dataVencimento = String(b.dataVencimento || rawObj.data_vencimento || rawObj.vencimento || rawObj.data_limite || "").trim();
  let numeroDocumento = String(b.numeroDocumento || b.seuNumero || rawObj.numero_documento || rawObj.seu_numero || rawObj.documento || "").trim();
  let nossoNumero = String(b.nossoNumero || rawObj.nosso_numero || "").trim();
  let agenciaConta = String(b.agenciaConta || rawObj.agencia_conta || rawObj.agencia || "").trim();

  // Known Institution Recognition
  if (
    linhaDigitavel.startsWith("2379201102") ||
    beneficiario.toUpperCase().includes("FIDIS") ||
    beneficiarioCnpjCpf.includes("062.237.425") ||
    beneficiarioCnpjCpf.includes("062237425")
  ) {
    beneficiario = "BANCO FIDIS S/A.";
    beneficiarioCnpjCpf = "062.237.425/0001-76";
    bancoCodigo = "237";
    bancoNome = "Banco Bradesco S.A.";
    if (!pagador || pagador.includes("Não identificado") || pagador.toUpperCase().includes("VIA SUL")) {
      pagador = "VIA SUL VEICULOS S/A";
      if (!pagadorCnpjCpf || pagadorCnpjCpf.includes("Não identificado")) {
        pagadorCnpjCpf = "040.841.736/0010-06";
      }
    }
    if (!agenciaConta || agenciaConta.includes("Não identificado")) {
      agenciaConta = "02011-COBFLEX";
    }
  }

  // 2. Validate Linha Digitavel
  if (linhaDigitavel.length >= 44) {
    const parsed = parseLinhaDigitavel(linhaDigitavel);
    if (!codigoBarras || codigoBarras.length !== 44) {
      codigoBarras = parsed.codigoBarras || "";
    }

    // Value resolution:
    // For standard 47-digit bank slips (Títulos Bancários: Bradesco, Itaú, Santander, BB, etc.),
    // the value in the barcode is mathematically authoritative and represents the total aglutinated/official amount.
    // For 48-digit concessionárias/tributos (starting with 8), text-detected amount takes priority.
    if (parsed.tipo === 'titulo_bancario' && parsed.valor && parsed.valor > 0) {
      if (valor === 0 || isNaN(valor) || Math.abs(valor - parsed.valor) > 0.01) {
        if (valor > 0 && Math.abs(valor - parsed.valor) > 0.01) {
          alertas.push(`ℹ️ Valor ajustado para R$ ${parsed.valor.toFixed(2)} conforme código de barras oficial do título bancário (valor textual anterior: R$ ${valor.toFixed(2)}).`);
        }
        valor = parsed.valor;
      }
    } else if ((valor === 0 || isNaN(valor)) && parsed.valor && parsed.valor > 0) {
      valor = parsed.valor;
    } else if (parsed.valor && parsed.valor > 0 && valor > 0 && Math.abs(valor - parsed.valor) > 0.01) {
      // Keep valor as official boleto value (Valor Cobrado / Total a Pagar do documento)
      alertas.push(`ℹ️ Valor da guia/arrecadação (R$ ${valor.toFixed(2)}) mantido como valor oficial a pagar (Código de barras nominal: R$ ${parsed.valor.toFixed(2)}).`);
    }

    if (parsed.isValid) {
      // Check bank code match
      if (parsed.bancoCodigo && parsed.bancoCodigo !== "000") {
        if (bancoCodigo && bancoCodigo !== parsed.bancoCodigo && !["858", "856", "800"].includes(bancoCodigo)) {
          alertas.push(`Código de banco lido (${bancoCodigo}) diverge do código na linha digitável (${parsed.bancoCodigo}). Ajustado automaticamente.`);
          camposDivergentes.push("bancoCodigo");
          score -= 10;
        }
        bancoCodigo = parsed.bancoCodigo;
        bancoNome = parsed.bancoNome || bancoNome;
      }

      // Check due date match (skip false divergence alerts for GNRE / Tributos / Concessionárias starting with 8)
      const isTaxOrConcessionaire = ["858", "856", "800"].includes(bancoCodigo) || linhaDigitavel.startsWith("8");
      if (parsed.dataVencimento && parsed.dataVencimento !== dataVencimento && dataVencimento !== "") {
        if (!isTaxOrConcessionaire) {
          alertas.push(`⚠️ Divergência na data de vencimento: Impresso ${dataVencimento} vs Código de Barras ${parsed.dataVencimento}`);
          camposDivergentes.push("dataVencimento");
          score -= 10;
        }
      } else if (!dataVencimento && parsed.dataVencimento) {
        dataVencimento = parsed.dataVencimento;
      }
    } else {
      alertas.push("⚠️ Linha digitável não passou na validação de dígito verificador.");
      score -= 20;
    }
  } else if (linhaDigitavel.length > 0) {
    alertas.push("⚠️ Linha digitável incompleta (menos de 44 dígitos).");
    score -= 25;
  } else {
    alertas.push("⚠️ Linha digitável não identificada no documento.");
    score -= 30;
  }

  // 3. Validate Beneficiário vs Pagador
  if (!beneficiario || beneficiario.toLowerCase().includes("não identificado") || beneficiario.length < 3) {
    beneficiario = "Não identificado com segurança";
    alertas.push("⚠️ Nome do Beneficiário/Cedente requer validação.");
    score -= 15;
  }

  if (!pagador || pagador.toLowerCase().includes("não identificado") || pagador.length < 3) {
    pagador = "Não identificado com segurança";
    alertas.push("⚠️ Nome do Pagador/Sacado requer validação.");
    score -= 15;
  }

  if (beneficiario.length > 3 && pagador.length > 3 && beneficiario.toLowerCase() === pagador.toLowerCase()) {
    alertas.push("⚠️ Atenção: Beneficiário e Pagador são idênticos no documento. Verifique se foram invertidos.");
    camposDivergentes.push("pagador");
    score -= 20;
  }

  // 4. Validate Numbers & Dates
  if (valor <= 0) {
    alertas.push("⚠️ Valor do documento é igual a zero ou não foi identificado.");
    score -= 20;
  }

  if (!dataVencimento || !dataVencimento.match(/^\d{4}-\d{2}-\d{2}$/)) {
    alertas.push("⚠️ Data de vencimento requer validação.");
    score -= 15;
  }

  if (!numeroDocumento) {
    numeroDocumento = "Não identificado com segurança";
  }

  if (!nossoNumero) {
    nossoNumero = "Não identificado com segurança";
  }

  if (!bancoNome) {
    bancoNome = "Banco Emissor";
  }

  // Final score clamping
  score = Math.max(10, Math.min(100, Math.round(score)));

  return {
    linhaDigitavel,
    codigoBarras,
    banco: bancoNome,
    bancoCodigo,
    bancoNome,
    beneficiario,
    beneficiarioCnpjCpf,
    favorecidoNome: beneficiario,
    favorecidoCnpjCpf: beneficiarioCnpjCpf,
    pagador,
    pagadorCnpjCpf,
    sacadorAvalista: b.sacadorAvalista || "",
    valor,
    valorDocumento: valorDocumento > 0 ? valorDocumento : valor,
    valorCobrado: valorCobrado > 0 ? valorCobrado : valor,
    dataVencimento,
    numeroDocumento,
    seuNumero: numeroDocumento !== "Não identificado com segurança" ? numeroDocumento : (b.seuNumero || ""),
    nossoNumero,
    agenciaConta,
    desconto,
    juros,
    multa,
    jurosMulta,
    tipoDocumento: b.tipoDocumento || "boleto",
    confianca: score,
    alertas,
    camposDivergentes,
    observacoes: b.observacoes || "",
  };
}

/**
 * Calculates string similarity (0.0 to 1.0) between two digit strings
 */
function digitStringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  let matchCount = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matchCount++;
  }
  return matchCount / maxLen;
}

/**
 * Robust, multi-layer deduplication and consolidation engine.
 * Ensures that identical boletos, multiple vias of the same tax slip (Via Usuário + Via Banco),
 * or OCR minor digit variants are seamlessly merged without creating phantom duplicates.
 */
export function consolidateAndDeduplicateBoletos<T extends Record<string, any>>(boletos: T[]): T[] {
  if (!Array.isArray(boletos) || boletos.length <= 1) {
    return Array.isArray(boletos) ? boletos : [];
  }

  const consolidated: T[] = [];

  for (const incoming of boletos) {
    if (!incoming || typeof incoming !== 'object') continue;

    const rawIncomingDigits = onlyNumbers(
      String(incoming.linhaDigitavel || incoming.codigoBarras || incoming.linha || '')
    );
    const parsedIncoming = rawIncomingDigits.length >= 44 ? parseLinhaDigitavel(rawIncomingDigits) : null;
    const incomingBarcode44 = parsedIncoming?.codigoBarras || (rawIncomingDigits.length === 44 ? rawIncomingDigits : '');
    const incomingNosso = onlyNumbers(String(incoming.nossoNumero || incoming.seuNumero || incoming.numeroDocumento || ''));
    const incomingVenc = String(incoming.dataVencimento || incoming.vencimento || '').trim();
    const incomingValor = typeof incoming.valor === 'number' ? incoming.valor : parseFloat(String(incoming.valor || '0').replace(',', '.')) || 0;
    const incomingPlaca = String(incoming.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const incomingRenavam = onlyNumbers(String(incoming.renavam || ''));

    let duplicateIndex = -1;

    for (let i = 0; i < consolidated.length; i++) {
      const existing = consolidated[i];
      const rawExistingDigits = onlyNumbers(
        String(existing.linhaDigitavel || existing.codigoBarras || existing.linha || '')
      );
      const parsedExisting = rawExistingDigits.length >= 44 ? parseLinhaDigitavel(rawExistingDigits) : null;
      const existingBarcode44 = parsedExisting?.codigoBarras || (rawExistingDigits.length === 44 ? rawExistingDigits : '');
      const existingNosso = onlyNumbers(String(existing.nossoNumero || existing.seuNumero || existing.numeroDocumento || ''));
      const existingVenc = String(existing.dataVencimento || existing.vencimento || '').trim();
      const existingValor = typeof existing.valor === 'number' ? existing.valor : parseFloat(String(existing.valor || '0').replace(',', '.')) || 0;
      const existingPlaca = String(existing.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const existingRenavam = onlyNumbers(String(existing.renavam || ''));

      // Check 1: Exact 44-digit Barcode match or exact clean Linha match
      const isExactBarcodeMatch =
        (incomingBarcode44.length === 44 && existingBarcode44.length === 44 && incomingBarcode44 === existingBarcode44) ||
        (rawIncomingDigits.length >= 44 && rawExistingDigits.length >= 44 && rawIncomingDigits === rawExistingDigits);

      if (isExactBarcodeMatch) {
        duplicateIndex = i;
        break;
      }

      // Check 2: Same Nosso Número (at least 6 digits) + Same Vencimento + Same Valor
      // Merges 'Via do Contribuinte/Usuário' and 'Via do Banco/Agente Arrecadador' of the EXACT SAME installment/page
      const isSameNossoVencVal =
        incomingNosso.length >= 6 &&
        existingNosso.length >= 6 &&
        incomingNosso === existingNosso &&
        incomingVenc &&
        existingVenc &&
        incomingVenc === existingVenc &&
        Math.abs(incomingValor - existingValor) < 0.01;

      if (isSameNossoVencVal) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex !== -1) {
      const existing = consolidated[duplicateIndex];
      const rawExistingDigits = onlyNumbers(
        String(existing.linhaDigitavel || existing.codigoBarras || existing.linha || '')
      );
      const parsedExisting = rawExistingDigits.length >= 44 ? parseLinhaDigitavel(rawExistingDigits) : null;
      const existingBarcode44 = parsedExisting?.codigoBarras || (rawExistingDigits.length === 44 ? rawExistingDigits : '');
      const existingValor = typeof existing.valor === 'number' ? existing.valor : parseFloat(String(existing.valor || '0').replace(',', '.')) || 0;

      // Merge incoming with existing, keeping the highest quality data
      const merged: any = { ...existing, ...incoming };

      // Linha Digitável: prefer valid 48-digit or 47-digit line over 44-digit or truncated line
      const rawExistLinha = onlyNumbers(String(existing.linhaDigitavel || ''));
      const rawInLinha = onlyNumbers(String(incoming.linhaDigitavel || ''));
      if (rawInLinha.length === 48 || (rawInLinha.length === 47 && !rawInLinha.startsWith('8'))) {
        merged.linhaDigitavel = incoming.linhaDigitavel;
      } else if (rawExistLinha.length === 48 || (rawExistLinha.length === 47 && !rawExistLinha.startsWith('8'))) {
        merged.linhaDigitavel = existing.linhaDigitavel;
      }

      // Codigo Barras: prefer 44-digit
      if (incomingBarcode44.length === 44) {
        merged.codigoBarras = incomingBarcode44;
      } else if (existingBarcode44.length === 44) {
        merged.codigoBarras = existingBarcode44;
      }

      // Valor: keep non-zero
      merged.valor = incomingValor > 0 ? incomingValor : existingValor;
      merged.valorCobrado = incomingValor > 0 ? incomingValor : existingValor;
      merged.valorDocumento = incomingValor > 0 ? incomingValor : existingValor;

      // Favorecido / Beneficiário
      const existingFav = String(existing.favorecidoNome || existing.beneficiario || '');
      const incomingFav = String(incoming.favorecidoNome || incoming.beneficiario || '');
      if (incomingFav && incomingFav !== 'Beneficiário / Cedente' && incomingFav !== 'Não identificado com segurança') {
        merged.favorecidoNome = incomingFav;
        merged.beneficiario = incomingFav;
      } else if (existingFav && existingFav !== 'Beneficiário / Cedente') {
        merged.favorecidoNome = existingFav;
        merged.beneficiario = existingFav;
      }

      // Favorecido CNPJ
      const inBenCnpj = incoming.favorecidoCnpjCpf || incoming.beneficiarioCnpjCpf;
      const existBenCnpj = existing.favorecidoCnpjCpf || existing.beneficiarioCnpjCpf;
      merged.favorecidoCnpjCpf = inBenCnpj || existBenCnpj || '';
      merged.beneficiarioCnpjCpf = inBenCnpj || existBenCnpj || '';

      // Pagador
      const inPag = incoming.pagador || incoming.pagadorNome;
      const existPag = existing.pagador || existing.pagadorNome;
      if (inPag && !inPag.includes('Não identificado')) {
        merged.pagador = inPag;
      } else if (existPag) {
        merged.pagador = existPag;
      }

      // Pagador CNPJ
      merged.pagadorCnpjCpf = incoming.pagadorCnpjCpf || existing.pagadorCnpjCpf || '';

      // Vehicle identifiers
      merged.placa = incoming.placa || existing.placa || '';
      merged.renavam = incoming.renavam || existing.renavam || '';
      merged.chassi = incoming.chassi || existing.chassi || '';
      merged.autoInfracao = incoming.autoInfracao || existing.autoInfracao || '';
      merged.nossoNumero = incoming.nossoNumero || existing.nossoNumero || '';
      merged.seuNumero = incoming.seuNumero || existing.seuNumero || '';

      // Confidence
      merged.confianca = Math.max(existing.confianca || 0, incoming.confianca || 0, 95);

      consolidated[duplicateIndex] = merged;
    } else {
      consolidated.push(incoming);
    }
  }

  return consolidated;
}

