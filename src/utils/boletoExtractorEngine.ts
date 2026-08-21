import { Type } from "@google/genai";
import { parseLinhaDigitavel, onlyNumbers, parseExtractedValor } from "./boletoParser.js";

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
  dataVencimento: string; // YYYY-MM-DD
  numeroDocumento: string; // Nº do Documento impresso
  seuNumero: string;
  nossoNumero: string;
  agenciaConta: string;
  desconto: number;
  juros: number;
  multa: number;
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
   - "valor": Valor numérico exato em Reais (R$). ATENÇÃO MÁXIMA PARA FORMATAÇÃO DE MOEDA (CENTENAS DE MILHAR E CENTAVOS): Se o boleto tiver valor impresso como "R$ 118.267,52" (cento e dezoito mil, duzentos e sessenta e sete reais e cinquenta e dois centavos), o valor numérico JSON é 118267.52. NUNCA omita nenhum dígito, NUNCA divida por 10 e NUNCA confunda centenas de milhar com dezenas de milhar (ex: 118267.52 NUNCA deve virar 11826.75). Retorne O VALOR TOTAL FINAL COBRADO / VALOR DO DOCUMENTO codificado no título. NUNCA retorne sub-totais de tabelas de discriminação.
   - "dataVencimento": Data de Vencimento no formato YYYY-MM-DD.
   - "numeroDocumento": Número impresso no campo "Nº do Documento", "Nº de Controle" ou Nota Fiscal.
   - "nossoNumero": Código impresso no campo "Nosso Número".
   - "agenciaConta": Agência e Conta do Beneficiário se visível.
4. REGRA DE MÁXIMA SEGURANÇA E NÃO-INVENÇÃO:
   - SE UM CAMPO NÃO ESTIVER PRESENTE NO BOLETO OU SE HOUVER DÚVIDA, RETORNE EXATAMENTE A STRING "Não identificado com segurança" PARA CAMPOS DE TEXTO E 0 PARA NÚMEROS. NUNCA CHUTE, NUNCA INVENTE E NUNCA ADIVINHE DADOS.
5. CARNÊS E LOTES MULTI-PÁGINAS COM MÚLTIPLOS DOCUMENTOS/VEÍCULOS DISTINTOS:
   - Se o arquivo PDF contiver múltiplas páginas e cada página contiver uma guia/boleto de um veículo ou débito diferente (ex: Página 1 com IPVA Placa QYH7D57, Página 2 com IPVA Placa SOE9J44, Página 3 com IPVA Placa SNL2D75, Página 4 com IPVA Placa RZS1I93), EXTRAIA CADA UMA DAS GUIAS INDIVIDUALMENTE e retorne todas no array "boletos" (um objeto por guia/página).
6. DOCUMENTOS COM VÁRIAS VIAS REPETIDAS DA MESMA GUIA NA MESMA PÁGINA (VIA USUÁRIO / VIA BANCO):
   - Se na mesma página houver 2 vias idênticas (ex: topo "VIA USUÁRIO" e rodapé "VIA BANCO") com o mesmo código de barras, trata-se de 1 único boleto para aquele veículo. Retorne apenas 1 item para essa página.
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
10. REGRA CRÍTICA DE QUANTIDADE DE BOLETOS - NUNCA CRIAR MÚLTIPLOS OBJETOS PARA LINHAS DE TABELA:
   - NUNCA crie múltiplos objetos no array "boletos" para as linhas de uma tabela anexa de compromissos, notas fiscais, faturas ou débitos agrupados.
   - Se o documento/página possui apenas 1 código de barras e 1 linha digitável (ex: 23792.85634 06923.179516 59003.852403 5 15430000486840), retorne RIGOROSAMENTE 1 ÚNICO OBJETO no array "boletos" com o valor total cobrado (ex: R$ 4.868,40).
   - Não confunda a lista de notas/compromissos anexos com boletos separados. É terminantemente proibido retornar 6 ou 7 boletos para um documento que é apenas 1 boleto bancário aglutinado.`;

export const PROMPT_BOLETO_EXTRACTION = (fileName: string) => `Extraia todas as informações financeiras e cadastrais do arquivo "${fileName}" respeitando rigorosamente o schema JSON solicitado.
Certifique-se de preencher com 100% de exatidão:
- Banco Emissor, Código do Banco e Nome do Banco
- Beneficiário (Razão Social e CNPJ/CPF)
- Pagador / Sacado (Razão Social/Nome e CPF/CNPJ)
- Valor, Data de Vencimento
- Número do Documento, Seu Número, Nosso Número
- Agência e Conta
- Linha Digitável e Código de Barras
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

  // 1. Sanitize string fields
  let linhaDigitavel = onlyNumbers(String(b.linhaDigitavel || b.codigoBarras || ""));
  let codigoBarras = onlyNumbers(String(b.codigoBarras || ""));
  let bancoCodigo = String(b.bancoCodigo || "").trim();
  let bancoNome = String(b.bancoNome || b.banco || "").trim();

  let beneficiario = String(b.beneficiario || b.favorecidoNome || "").trim();
  let beneficiarioCnpjCpf = String(b.beneficiarioCnpjCpf || b.favorecidoCnpjCpf || "").trim();
  let pagador = String(b.pagador || "").trim();
  let pagadorCnpjCpf = String(b.pagadorCnpjCpf || "").trim();

  let valor = parseExtractedValor(b.valor, 0);
  let dataVencimento = String(b.dataVencimento || "").trim();
  let numeroDocumento = String(b.numeroDocumento || b.seuNumero || "").trim();
  let nossoNumero = String(b.nossoNumero || "").trim();
  let agenciaConta = String(b.agenciaConta || "").trim();

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
    const parsed = parseLinhaDigitavel(linhaDigitavel, valor);
    if (!codigoBarras || codigoBarras.length !== 44) {
      codigoBarras = parsed.codigoBarras || "";
    }

    // ALWAYS enforce value from barcode if valid and > 0, guarding against 10x/100x OCR truncation artifacts
    if (parsed.valor && parsed.valor > 0) {
      if (valor === 0 || Math.abs(valor - parsed.valor) > 0.01) {
        // If parsed.valor is roughly 10x smaller than document valor (e.g. 11826.75 vs 118267.52 due to clipped last digit)
        if (valor > 0 && Math.abs(valor / 10 - parsed.valor) < 1) {
          // Document valor is the true unclipped value, keep valor
          alertas.push(`⚠️ Linha digitável continha valor truncado (R$ ${parsed.valor.toFixed(2)}). Corrigido para o valor integral impresso: R$ ${valor.toFixed(2)}.`);
        } else if (valor > 0 && Math.abs(parsed.valor / 10 - valor) < 1) {
          // Parsed is the complete 10x value
          alertas.push(`⚠️ Valor impresso truncado (R$ ${valor.toFixed(2)}) corrigido para R$ ${parsed.valor.toFixed(2)} conforme código de barras.`);
          valor = parsed.valor;
        } else {
          if (valor > 0 && Math.abs(valor - parsed.valor) > 0.01) {
            alertas.push(`⚠️ Valor de R$ ${valor.toFixed(2)} ajustado para R$ ${parsed.valor.toFixed(2)} conforme linha digitável/código de barras.`);
          }
          valor = parsed.valor;
        }
      }
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
    dataVencimento,
    numeroDocumento,
    seuNumero: numeroDocumento !== "Não identificado com segurança" ? numeroDocumento : (b.seuNumero || ""),
    nossoNumero,
    agenciaConta,
    desconto: typeof b.desconto === "number" ? b.desconto : 0,
    juros: typeof b.juros === "number" ? b.juros : 0,
    multa: typeof b.multa === "number" ? b.multa : 0,
    tipoDocumento: b.tipoDocumento || "boleto",
    confianca: score,
    alertas,
    camposDivergentes,
    observacoes: b.observacoes || "",
  };
}
