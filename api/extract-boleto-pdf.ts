import zlib from "zlib";
import { GoogleGenAI } from "@google/genai";
import { parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText } from "../src/utils/boletoParser.js";
import {
  SYSTEM_INSTRUCTION_BOLETO,
  PROMPT_BOLETO_EXTRACTION,
  GEMINI_BOLETO_SCHEMA,
  validateAndCrossCheckBoleto,
} from "../src/utils/boletoExtractorEngine.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};
export const maxDuration = 60;

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
                  { text: PROMPT_BOLETO_EXTRACTION(fileName) },
                ],
              },
            ],
            config: {
              systemInstruction: SYSTEM_INSTRUCTION_BOLETO,
              temperature: 0.1,
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              responseSchema: GEMINI_BOLETO_SCHEMA as any,
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

    // Apply strict financial cross-validation & sanity checks
    boletosExtracted = boletosExtracted
      .filter((b) => b && typeof b === "object")
      .map((b) => validateAndCrossCheckBoleto(b));

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
