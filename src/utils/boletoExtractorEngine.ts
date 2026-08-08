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
   - "beneficiario": Quem RECEBE O DINHEIRO / Emissor / Cedente / Favorecido (Ex: "SUHAI SEGURADORA S.A.", "CLARO S.A.", "COMPESA"). NUNCA COLOQUE O NOME DO BANCO ARRECADADOR (como "Bradesco", "Banco Itaú") COMO BENEFICIÁRIO.
   - "beneficiarioCnpjCpf": CNPJ ou CPF do Beneficiário/Cedente.
   - "pagador": Quem DEVE PAGAR O BOLETO / Sacado / Cliente / Devedor (Ex: "JOAO DA SILVA", "EMPRESA ABC LTDA"). NUNCA confunda o Pagador com o Beneficiário!
   - "pagadorCnpjCpf": CPF ou CNPJ do Pagador.
3. DADOS FINANCEIROS E CÓDIGOS DE BARRAS:
   - "linhaDigitavel": Linha digitável completa de 47 dígitos (boletos bancários) ou 48 dígitos (concessionárias/tributos/DARF/GNRE).
   - "codigoBarras": Código de barras numérico de 44 dígitos sem espaços.
   - "valor": Valor numérico exato em Reais (R$).
   - "dataVencimento": Data de Vencimento no formato YYYY-MM-DD.
   - "numeroDocumento": Número impresso no campo "Nº do Documento" ou Nota Fiscal.
   - "nossoNumero": Código impresso no campo "Nosso Número".
   - "agenciaConta": Agência e Conta do Beneficiário se visível.
4. REGRA DE MÁXIMA SEGURANÇA E NÃO-INVENÇÃO:
   - SE UM CAMPO NÃO ESTIVER PRESENTE NO BOLETO OU SE HOUVER DÚVIDA, RETORNE EXATAMENTE A STRING "Não identificado com segurança" PARA CAMPOS DE TEXTO E 0 PARA NÚMEROS. NUNCA CHUTE, NUNCA INVENTE E NUNCA ADIVINHE DADOS.
5. CARNÊS COM MÚLTIPLAS PARCELAS:
   - Se o documento for um carnê com N parcelas, retorne CADA PARCELA como um item individual no array "boletos" com sua própria data de vencimento e valor.`;

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

  let valor = typeof b.valor === "number" ? b.valor : parseFloat(String(b.valor || "0")) || 0;
  let dataVencimento = String(b.dataVencimento || "").trim();
  let numeroDocumento = String(b.numeroDocumento || b.seuNumero || "").trim();
  let nossoNumero = String(b.nossoNumero || "").trim();
  let agenciaConta = String(b.agenciaConta || "").trim();

  // 2. Validate Linha Digitavel
  if (linhaDigitavel.length >= 44) {
    const parsed = parseLinhaDigitavel(linhaDigitavel);
    if (parsed.isValid) {
      if (!codigoBarras || codigoBarras.length !== 44) {
        codigoBarras = parsed.codigoBarras || "";
      }

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

      // Check value match
      if (parsed.valor && parsed.valor > 0) {
        if (valor > 0 && Math.abs(valor - parsed.valor) > 0.05 && !["858", "856", "800"].includes(bancoCodigo)) {
          alertas.push(`⚠️ Divergência de valor: Impresso R$ ${valor.toFixed(2)} vs Linha Digitável R$ ${parsed.valor.toFixed(2)}`);
          camposDivergentes.push("valor");
          score -= 15;
        } else if (valor === 0) {
          valor = parsed.valor;
        }
      }

      // Check due date match
      if (parsed.dataVencimento && parsed.dataVencimento !== dataVencimento && dataVencimento !== "") {
        alertas.push(`⚠️ Divergência na data de vencimento: Impresso ${dataVencimento} vs Código de Barras ${parsed.dataVencimento}`);
        camposDivergentes.push("dataVencimento");
        score -= 10;
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
