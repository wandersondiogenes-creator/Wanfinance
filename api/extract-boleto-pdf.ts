import zlib from "zlib";
import { GoogleGenAI, Type } from "@google/genai";
import { parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText } from "../src/utils/boletoParser.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

function extractTextFromPdfBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length < 4) return "";
  const header = buffer.subarray(0, 10).toString("ascii");
  if (!header.includes("%PDF")) {
    return ""; // Not a PDF file (e.g. image/jpeg, png, webp, etc.)
  }

  let combinedText = "";

  try {
    combinedText += buffer.toString("latin1") + " ";
  } catch (e) {
    // Ignore
  }

  try {
    const streamMarker = Buffer.from("stream");
    const endStreamMarker = Buffer.from("endstream");

    let pos = 0;
    let streamCount = 0;
    while (pos < buffer.length && streamCount < 150) {
      const startIdx = buffer.indexOf(streamMarker, pos);
      if (startIdx === -1) break;

      const endIdx = buffer.indexOf(endStreamMarker, startIdx + 6);
      if (endIdx === -1) break;

      let contentStart = startIdx + 6;
      if (buffer[contentStart] === 0x0d && buffer[contentStart + 1] === 0x0a) {
        contentStart += 2;
      } else if (buffer[contentStart] === 0x0a || buffer[contentStart] === 0x0d) {
        contentStart += 1;
      }

      let contentEnd = endIdx;
      if (contentEnd > contentStart && buffer[contentEnd - 1] === 0x0a) contentEnd--;
      if (contentEnd > contentStart && buffer[contentEnd - 1] === 0x0d) contentEnd--;

      if (contentEnd > contentStart) {
        const streamBuffer = buffer.subarray(contentStart, contentEnd);
        let decompressed = "";
        try {
          decompressed = zlib.inflateSync(streamBuffer).toString("utf-8");
        } catch {
          try {
            decompressed = zlib.inflateRawSync(streamBuffer).toString("utf-8");
          } catch {
            try {
              decompressed = zlib.unzipSync(streamBuffer).toString("utf-8");
            } catch {
              // Ignore uncompressed stream
            }
          }
        }

        if (decompressed) {
          combinedText += " " + decompressed;
        }
      }

      pos = endIdx + 8;
      streamCount++;
    }
  } catch (streamErr) {
    console.warn("[Local PDF Parser] Aviso ao descomprimir streams:", streamErr);
  }

  return combinedText;
}

function extractBoletosLocallyFromBuffer(buffer: Buffer): any[] {
  const rawText = extractTextFromPdfBuffer(buffer);
  if (!rawText || rawText.trim().length === 0) {
    return [];
  }

  const boletosFound: any[] = [];
  const seenLines = new Set<string>();

  const patterns = [
    /\d{5}[\.\s]*\d{5}[\.\s]*\d{5}[\.\s]*\d{6}[\.\s]*\d{5}[\.\s]*\d{6}[\.\s]*\d[\.\s]*\d{14}/g,
    /\d{11,12}[\.\s-]*\d{11,12}[\.\s-]*\d{11,12}[\.\s-]*\d{11,12}/g,
    /\b\d{47,48}\b/g,
    /\b\d{44}\b/g,
  ];

  for (const pattern of patterns) {
    const matches = rawText.match(pattern);
    if (matches) {
      for (const matchStr of matches) {
        const clean = onlyNumbers(matchStr);
        if ((clean.length === 47 || clean.length === 48 || clean.length === 44) && !seenLines.has(clean)) {
          const parsed = parseLinhaDigitavel(clean);
          if (parsed.isValid) {
            seenLines.add(clean);
            let extractedValue = parsed.valor || 0;

            const valorMatch = rawText.match(/(?:TOTAL\s+A\s+RECOLHER|VALOR\s+TOTAL(?:\s+A\s+RECOLHER)?|TOTAL\s+A\s+PAGAR|VALOR\s+PRINCIPAL)\s*[:\s]*R?\$?\s*([\d\.]+(?:,\d{2})?)/i);
            if (valorMatch) {
              const valStr = valorMatch[1].replace(/\./g, '').replace(',', '.');
              const parsedVal = parseFloat(valStr);
              if (!isNaN(parsedVal) && parsedVal > 0) {
                if (extractedValue === 0 || parsed.bancoCodigo === '858' || parsed.bancoCodigo === '856') {
                  extractedValue = parsedVal;
                }
              }
            }

            let favorecidoNome = extractFavorecidoFromText(rawText, parsed.bancoNome);
            if (parsed.bancoCodigo === '858') {
              favorecidoNome = 'SEFAZ - Guia GNRE';
            } else if (parsed.bancoCodigo === '856') {
              favorecidoNome = 'Receita Federal - DARF';
            }

            boletosFound.push({
              linhaDigitavel: clean,
              codigoBarras: parsed.codigoBarras || clean,
              favorecidoNome,
              cedente: favorecidoNome,
              beneficiario: favorecidoNome,
              favorecidoCnpjCpf: "",
              CNPJ: "",
              valor: extractedValue,
              dataVencimento: parsed.dataVencimento || new Date().toISOString().split("T")[0],
              seuNumero: `PDF-TEXT-${boletosFound.length + 1}`,
              numeroDocumento: `PDF-TEXT-${boletosFound.length + 1}`,
              nossoNumero: "",
              bancoCodigo: parsed.bancoCodigo,
              bancoNome: parsed.bancoNome,
              banco: parsed.bancoNome,
              observacoes: "Extraído do texto do PDF via leitor local",
              confidence: 0.9,
            });
          }
        }
      }
    }
  }

  return boletosFound;
}

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { fileBase64, mimeType = "application/pdf", fileName = "boleto.pdf" } = body || {};

    if (!fileBase64) {
      return res.status(400).json({ error: "Conteúdo do arquivo em base64 não fornecido." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    // Clean Base64 and standardize MIME type without running regex on large base64 strings
    let cleanBase64 = fileBase64;
    let effectiveMimeType = typeof mimeType === "string" ? mimeType : "application/pdf";

    if (cleanBase64.startsWith("data:")) {
      const commaIndex = cleanBase64.indexOf(",");
      if (commaIndex !== -1) {
        const header = cleanBase64.substring(0, commaIndex);
        cleanBase64 = cleanBase64.substring(commaIndex + 1);
        const mimeMatch = header.match(/data:([^;]+)/);
        if (mimeMatch) {
          effectiveMimeType = mimeMatch[1].trim();
        }
      }
    }

    // Strip whitespaces or linebreaks from Base64 content
    cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, "");

    if (effectiveMimeType.includes("pdf")) {
      effectiveMimeType = "application/pdf";
    } else if (effectiveMimeType.includes("png")) {
      effectiveMimeType = "image/png";
    } else if (effectiveMimeType.includes("jpg") || effectiveMimeType.includes("jpeg")) {
      effectiveMimeType = "image/jpeg";
    } else if (effectiveMimeType.includes("webp")) {
      effectiveMimeType = "image/webp";
    }

    let boletosExtracted: any[] = [];
    let geminiApiError: string | null = null;

    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Você é um leitor óptico (OCR) e especialista financeiro de MÁXIMA PRECISÃO em boletos bancários brasileiros, carnês de pagamento, parcelamentos, faturas, tributos, guias de arrecadação e GNRE.

Analise com EXTREMA ATENÇÃO TODO O CONTEÚDO DE TODAS AS PÁGINAS do arquivo enviado (${fileName}).

REGRAS OBRIGATÓRIAS PARA CARNÊS E MÚLTIPLOS BOLETOS (EX: SEGUROS SUHAI, FINANCIAMENTOS, CONSÓRCIOS):
1. O arquivo pode ser um CARNÊ com várias parcelas (ex: 12 parcelas de seguro Suhai / financiamento), onde cada página contém 2, 3 ou mais cupons/parcelas (por exemplo: Parcela 01/012 a Parcela 12/012).
2. CADA PARCELA É UM BOLETO INDIVIDUAL com sua própria data de vencimento (ex: 04/05/2026, 25/05/2026, 25/06/2026...), valor próprio (ex: R$ 49,32 ou R$ 49,35), "Nº do Documento", "Nosso Número" e linha digitável.
3. Você DEVE PERCORRER TODAS AS PÁGINAS do PDF e extrair CADA UMA DAS PARCELAS como um boleto separado no array "boletos".
4. SE O CARNÊ TIVER 12 PARCELAS (01/012 até 12/012), VOCÊ DEVE RETORNAR EXATAMENTE 12 BOLETOS NO ARRAY! NUNCA pare na 1ª parcela e NUNCA pule nenhuma página.
5. EXTRAÇÃO DE NÚMEROS E IDENTIFICAÇÃO (MUITO IMPORTANTE):
   - "numeroDocumento": Número impresso no campo "Nº do Documento" do boleto (ex: "1003111990090/00000000/01" para a parcela 1, "1003111990090/00000000/02" para a parcela 2). Este é a Nota Fiscal/Número do Documento real.
   - "seuNumero": Coloque o "Nº do Documento" exato impresso na parcela (ex: "1003111990090/00000000/01"). NUNCA substitua por um número genérico se o "Nº do Documento" estiver visível.
   - "nossoNumero": Código impresso no campo "Nosso Número" ou "Cart. / Nosso Número" (ex: "5/00056921372-8", "5/00056921373-6").
6. LINHA DIGITÁVEL E DADOS FINANCEIROS:
   - "linhaDigitavel": Linha digitável completa de 47 dígitos (boletos bancários) ou 48 dígitos (concessionárias/tributos). Se para alguma parcela a linha digitável não estiver em texto corrido impresso no topo, mas você tiver Banco (237 - Bradesco), Agência (3392), Conta (0201560-9), Carteira (05), Nosso Número (ex: 5/00056921372-8), Vencimento e Valor, monte/calcule a linha digitável correspondente de 47 dígitos.
   - "favorecidoNome": NOME DA EMPRESA COBRADORA OU BENEFICIÁRIO/CEDENTE QUE ESTÁ EMITINDO A FATURA OU RECEBENDO O PAGAMENTO (ex: "SUHAI SEGURADORA S/A", "CLARO S.A."). NUNCA COLOQUE O NOME DO BANCO EMISSOR (como "Bradesco", "Banco Itaú") no favorecidoNome!
   - "favorecidoCnpjCpf": CNPJ do Beneficiário (ex: "16.825.255/0001-23").
   - "valor": Valor numérico exato do documento para ESTA PARCELA (ex: 49.32 ou 49.35).
   - "dataVencimento": Data de Vencimento de ESTA PARCELA no formato YYYY-MM-DD.
   - "bancoCodigo": Código de 3 dígitos do banco (ex: "237" para Bradesco).
   - "bancoNome": Nome do banco emissor (ex: "Bradesco").
   - "observacoes": Ex: "Parcela 01/012 de Suhai Seguradora".

REGRA DE SCHEMA JSON:
NUNCA retorne null ou undefined para nenhum campo! Use 0 para números e '' para strings.`;

      const modelsToTry = [
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
      ];
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: effectiveMimeType,
                      data: cleanBase64,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  boletos: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        linhaDigitavel: { type: Type.STRING },
                        codigoBarras: { type: Type.STRING },
                        valor: { type: Type.NUMBER },
                        dataVencimento: { type: Type.STRING },
                        cedente: { type: Type.STRING },
                        beneficiario: { type: Type.STRING },
                        favorecidoNome: { type: Type.STRING },
                        CNPJ: { type: Type.STRING },
                        favorecidoCnpjCpf: { type: Type.STRING },
                        numeroDocumento: { type: Type.STRING },
                        seuNumero: { type: Type.STRING },
                        nossoNumero: { type: Type.STRING },
                        banco: { type: Type.STRING },
                        bancoCodigo: { type: Type.STRING },
                        bancoNome: { type: Type.STRING },
                        observacoes: { type: Type.STRING },
                        desconto: { type: Type.NUMBER },
                        jurosMulta: { type: Type.NUMBER },
                        confidence: { type: Type.NUMBER },
                      },
                    },
                  },
                },
                required: ["boletos"],
              },
            },
          });

          const rawText = response?.text || "{}";
          let jsonText = rawText.trim();
          if (jsonText.startsWith("```json")) {
            jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
          } else if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
          }

          const parsedData = JSON.parse(jsonText);
          if (Array.isArray(parsedData.boletos)) {
            boletosExtracted = parsedData.boletos;
            break;
          }
        } catch (err: any) {
          const errRaw = String(err?.message || err);
          if (errRaw.includes("503") || errRaw.includes("high demand") || errRaw.includes("UNAVAILABLE")) {
            console.info(`[Vercel API] Model ${modelName} high demand (503), trying next model...`);
            await new Promise((resolve) => setTimeout(resolve, 200));
          } else if (errRaw.includes("429") || errRaw.includes("RESOURCE_EXHAUSTED") || errRaw.includes("Quota exceeded")) {
            geminiApiError = "A cota gratuita da API Gemini foi temporariamente excedida (Limite 429). Aguarde alguns segundos e clique em 'Tentar Novamente'.";
            console.info(`[Vercel API] Model ${modelName} hit rate limit, trying next model...`);
            await new Promise((resolve) => setTimeout(resolve, 500));
          } else {
            geminiApiError = errRaw;
            console.warn(`[Vercel API] Model ${modelName} failed:`, geminiApiError);
          }
        }
      }
    } else {
      geminiApiError = "GEMINI_API_KEY não configurada no ambiente do servidor.";
    }

    if (boletosExtracted.length === 0 && cleanBase64) {
      try {
        const buffer = Buffer.from(cleanBase64, "base64");
        boletosExtracted = extractBoletosLocallyFromBuffer(buffer);
      } catch (err) {
        console.error("Erro fallback local Vercel:", err);
      }
    }

    if (!Array.isArray(boletosExtracted)) {
      boletosExtracted = [];
    }

    boletosExtracted = boletosExtracted
      .filter((b) => b && typeof b === "object")
      .map((b) => {
        const rawDigits = String(b.linhaDigitavel || b.codigoBarras || "");
        const cleanLinha = onlyNumbers(rawDigits);

        b.favorecidoNome = b.favorecidoNome || b.beneficiario || b.cedente || "Beneficiário Não Identificado";
        b.cedente = b.cedente || b.favorecidoNome;
        b.beneficiario = b.beneficiario || b.favorecidoNome;
        b.favorecidoCnpjCpf = b.favorecidoCnpjCpf || b.CNPJ || "";
        b.CNPJ = b.CNPJ || b.favorecidoCnpjCpf || "";
        b.numeroDocumento = b.numeroDocumento || b.seuNumero || "";
        b.seuNumero = b.numeroDocumento || b.seuNumero || "";
        b.banco = b.banco || b.bancoNome || "";

        if (cleanLinha.length >= 44) {
          const parsedCheck = parseLinhaDigitavel(cleanLinha);
          if (parsedCheck.isValid) {
            b.linhaDigitavel = cleanLinha;
            b.codigoBarras = b.codigoBarras || parsedCheck.codigoBarras;
            b.bancoCodigo = parsedCheck.bancoCodigo || b.bancoCodigo || "000";
            b.bancoNome = parsedCheck.bancoNome || b.bancoNome || b.banco;
            b.banco = b.bancoNome;
            if (!b.valor || Number(b.valor) === 0) b.valor = parsedCheck.valor;
            if (parsedCheck.dataVencimento && (!b.dataVencimento || b.dataVencimento === '')) {
              b.dataVencimento = parsedCheck.dataVencimento;
            }
          }
        }
        return b;
      });

    // Deduplicate boletos (prevents 1st, 2nd, 3rd via duplication while keeping distinct parcelas)
    const seenKeys = new Set<string>();
    const uniqueBoletos: typeof boletosExtracted = [];

    for (const b of boletosExtracted) {
      const rawDigits = String(b.linhaDigitavel || b.codigoBarras || "");
      const cleanDigits = onlyNumbers(rawDigits);
      const nosso = String(b.nossoNumero || "").trim();
      const venc = String(b.dataVencimento || "").trim();

      let uniqueKey = "";
      if (cleanDigits && cleanDigits.length >= 44) {
        uniqueKey = cleanDigits;
      } else if (nosso || venc) {
        uniqueKey = `${nosso}_${venc}_${b.valor || 0}`;
      }

      if (uniqueKey) {
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          uniqueBoletos.push(b);
        }
      } else {
        uniqueBoletos.push(b);
      }
    }

    boletosExtracted = uniqueBoletos;

    return res.status(200).json({
      success: true,
      fileName,
      totalEncontrados: boletosExtracted.length,
      geminiApiError,
      boletos: boletosExtracted,
    });
  } catch (error: any) {
    const errStr = String(error?.message || error);
    let fallbackBoletos: any[] = [];
    try {
      const rawBody = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      let rawB64 = rawBody?.fileBase64;
      if (typeof rawB64 === "string" && rawB64.length > 0) {
        if (rawB64.includes(",")) rawB64 = rawB64.split(",")[1];
        rawB64 = rawB64.replace(/[\r\n\s]+/g, "");
        const buffer = Buffer.from(rawB64, "base64");
        fallbackBoletos = extractBoletosLocallyFromBuffer(buffer);
      }
    } catch (fbErr) {
      console.error("Erro emergência local handler:", fbErr);
    }

    return res.status(200).json({
      success: true,
      fileName: req.body?.fileName || "boleto.pdf",
      totalEncontrados: fallbackBoletos.length,
      geminiApiError: `Aviso no servidor: ${errStr}`,
      boletos: fallbackBoletos,
    });
  }
}
