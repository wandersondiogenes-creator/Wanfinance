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
  let combinedText = "";

  try {
    combinedText += buffer.toString("utf-8") + " " + buffer.toString("latin1") + " ";
  } catch (e) {
    // Ignore
  }

  try {
    const pdfStr = buffer.toString("latin1");
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(pdfStr)) !== null) {
      const streamStart = match.index + match[0].indexOf(match[1]);
      const streamEnd = streamStart + match[1].length;
      const streamBuffer = buffer.subarray(streamStart, streamEnd);

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
            // Stream uncompressed
          }
        }
      }

      if (decompressed) {
        combinedText += " " + decompressed;
      }
    }
  } catch (streamErr) {
    console.warn("[Local PDF Parser] Aviso ao descomprimir streams:", streamErr);
  }

  return combinedText;
}

function extractBoletosLocallyFromBuffer(buffer: Buffer): any[] {
  const boletosFound: any[] = [];
  const seenLines = new Set<string>();

  const rawText = extractTextFromPdfBuffer(buffer);

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
          seenLines.add(clean);
          const parsed = parseLinhaDigitavel(clean);
          if (parsed.isValid) {
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

  if (boletosFound.length === 0) {
    const digitsOnly = onlyNumbers(rawText);
    for (let i = 0; i <= digitsOnly.length - 47; i++) {
      const chunk = digitsOnly.substring(i, i + 47);
      if (!seenLines.has(chunk)) {
        const parsed = parseLinhaDigitavel(chunk);
        if (parsed.isValid && parsed.valor > 0 && parsed.bancoCodigo !== '000') {
          seenLines.add(chunk);
          const fav = extractFavorecidoFromText(rawText, parsed.bancoNome);
          boletosFound.push({
            linhaDigitavel: chunk,
            codigoBarras: parsed.codigoBarras || chunk,
            favorecidoNome: fav,
            cedente: fav,
            beneficiario: fav,
            favorecidoCnpjCpf: "",
            CNPJ: "",
            valor: parsed.valor,
            dataVencimento: parsed.dataVencimento || new Date().toISOString().split("T")[0],
            seuNumero: `PDF-TEXT-${boletosFound.length + 1}`,
            numeroDocumento: `PDF-TEXT-${boletosFound.length + 1}`,
            nossoNumero: "",
            bancoCodigo: parsed.bancoCodigo,
            bancoNome: parsed.bancoNome,
            banco: parsed.bancoNome,
            observacoes: "Extraído via varredura contínua do PDF",
            confidence: 0.85,
          });
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

    // Clean Base64 and standardize MIME type
    let cleanBase64 = fileBase64;
    let effectiveMimeType = mimeType || "application/pdf";

    const dataUriMatch = fileBase64.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUriMatch) {
      effectiveMimeType = dataUriMatch[1].trim();
      cleanBase64 = dataUriMatch[2].trim();
    } else {
      cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "").trim();
    }

    // Strip whitespaces or linebreaks from Base64 content
    cleanBase64 = cleanBase64.replace(/\s+/g, "");

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

      const prompt = `Você é um leitor óptico (OCR) e especialista financeiro em boletos bancários brasileiros, carnês, faturas, tributos, guias de arrecadação e GNRE.
Analise com MÁXIMA ATENÇÃO TODO O CONTEÚDO (texto digital ou imagens/páginas digitalizadas) do arquivo PDF/Imagem enviado (${fileName}).

Extraia com precisão TODOS OS BOLETOS identificados. Se for um carnê (ex: Suhai / financiamento com 12 parcelas), EXTRAIA CADA PARCELA COMO UM BOLETO INDIVIDUAL NO ARRAY "boletos".

Retorne para cada boleto os campos:
1. "linhaDigitavel": Linha digitável com 47 dígitos (boletos bancários) ou 48 dígitos (concessionárias/tributos/GNRE/DARF).
2. "codigoBarras": Código de barras numérico de 44 dígitos.
3. "valor": Valor numérico total/nominal da parcela ou documento (ex: 150.50).
4. "dataVencimento": Data de vencimento no formato YYYY-MM-DD.
5. "cedente": Nome do Cedente / Beneficiário / Empresa Cobradora.
6. "beneficiario": Nome do Beneficiário / Empresa Cobradora (NUNCA o nome do banco).
7. "favorecidoNome": Nome da empresa cobradora / favorecido.
8. "CNPJ": CNPJ ou CPF do Beneficiário/Cedente se disponível.
9. "favorecidoCnpjCpf": CNPJ ou CPF do Beneficiário/Cedente.
10. "numeroDocumento": Número do documento, nota fiscal ou parcela (ex: Parcela 01/012).
11. "seuNumero": Número do documento ou referência de controle.
12. "nossoNumero": Código Nosso Número.
13. "banco": Nome do banco emissor.
14. "bancoCodigo": Código numérico de 3 dígitos do banco (ex: '001', '237', '341', '104', '033', '756', '748', '858' para GNRE, '856' para DARF).
15. "bancoNome": Nome do banco emissor (ex: Bradesco, Itaú, Banco do Brasil).
16. "observacoes": Detalhes sobre a parcela ou documento.
17. "confidence": Grau de confiança da extração (0.0 a 1.0).`;

      const modelsToTry = ["gemini-3.6-flash", "gemini-flash-latest"];
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
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
            config: {
              responseMimeType: "application/json",
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

          const rawText = response.text || "{}";
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
          geminiApiError = String(err?.message || err);
          console.warn(`[Vercel API] Model ${modelName} failed:`, geminiApiError);
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

    boletosExtracted = boletosExtracted.map((b) => {
      const rawDigits = b.linhaDigitavel || b.codigoBarras || "";
      const cleanLinha = onlyNumbers(rawDigits);

      b.favorecidoNome = b.favorecidoNome || b.beneficiario || b.cedente || "Beneficiário Não Identificado";
      b.cedente = b.cedente || b.favorecidoNome;
      b.beneficiario = b.beneficiario || b.favorecidoNome;
      b.favorecidoCnpjCpf = b.favorecidoCnpjCpf || b.CNPJ || "";
      b.CNPJ = b.CNPJ || b.favorecidoCnpjCpf || "";
      b.seuNumero = b.seuNumero || b.numeroDocumento || "";
      b.numeroDocumento = b.numeroDocumento || b.seuNumero || "";
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

    return res.status(200).json({
      success: true,
      fileName,
      totalEncontrados: boletosExtracted.length,
      geminiApiError,
      boletos: boletosExtracted,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: "Não foi possível extrair os dados do boleto PDF.",
      details: String(error?.message || error),
    });
  }
}
