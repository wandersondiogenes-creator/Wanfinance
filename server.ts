import express from "express";
import path from "path";
import zlib from "zlib";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { parseLinhaDigitavel, onlyNumbers } from "./src/utils/boletoParser";

/**
 * Local helper to extract text from PDF buffer, including zlib FlateDecode compressed streams
 */
function extractTextFromPdfBuffer(buffer: Buffer): string {
  let combinedText = "";

  // 1. Direct string views
  try {
    combinedText += buffer.toString("utf-8") + " " + buffer.toString("latin1") + " ";
  } catch (e) {
    // Ignore
  }

  // 2. Locate and inflate compressed streams (FlateDecode)
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
            // Stream was uncompressed or unsupported filter
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

/**
 * Local regex extractor for Brazilian boletos, invoices, utility bills, and tax slips
 */
function extractBoletosLocallyFromBuffer(buffer: Buffer): any[] {
  const boletosFound: any[] = [];
  const seenLines = new Set<string>();

  const rawText = extractTextFromPdfBuffer(buffer);

  // Patterns for Brazilian boletos:
  // 1. Formatted 47-digit Linha Digitável: 00190.00009 01234.567004 00001.234567 8 85000000012345
  // 2. Formatted 48-digit Concessionária / Tributo: 84670000001-7 23450012100-3 00000000000-0 00000000000-0
  // 3. Raw 47 or 48 contiguous digits
  // 4. Raw 44-digit barcodes
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

            // Try to extract "VALOR TOTAL A RECOLHER" / "TOTAL A RECOLHER" directly from text
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

            let favorecidoNome = `Beneficiário (${parsed.bancoNome})`;
            const sefazMatch = rawText.match(/(SECRETARIA\s+DA\s+FAZENDA[^\r\n]*|SEFAZ[-/ ][A-Z]{2}|GOVERNO\s+DO\s+ESTADO[^\r\n]*|RECEITA\s+FEDERAL)/i);
            if (sefazMatch) {
              favorecidoNome = sefazMatch[1].trim();
            } else if (parsed.bancoCodigo === '858') {
              favorecidoNome = 'SEFAZ - Guia GNRE';
            } else if (parsed.bancoCodigo === '856') {
              favorecidoNome = 'Receita Federal - DARF';
            }

            boletosFound.push({
              linhaDigitavel: clean,
              codigoBarras: parsed.codigoBarras || clean,
              favorecidoNome,
              favorecidoCnpjCpf: "",
              valor: extractedValue,
              dataVencimento: parsed.dataVencimento || new Date().toISOString().split("T")[0],
              seuNumero: `PDF-TEXT-${boletosFound.length + 1}`,
              nossoNumero: "",
              bancoCodigo: parsed.bancoCodigo,
              bancoNome: parsed.bancoNome,
              observacoes: "Extraído do texto do PDF via leitor local",
              confidence: 0.9,
            });
          }
        }
      }
    }
  }

  // Scan continuous digit stream if no matches yet
  if (boletosFound.length === 0) {
    const digitsOnly = onlyNumbers(rawText);
    for (let i = 0; i <= digitsOnly.length - 47; i++) {
      const chunk = digitsOnly.substring(i, i + 47);
      if (!seenLines.has(chunk)) {
        const parsed = parseLinhaDigitavel(chunk);
        if (parsed.isValid && parsed.valor > 0) {
          seenLines.add(chunk);
          boletosFound.push({
            linhaDigitavel: chunk,
            codigoBarras: parsed.codigoBarras || chunk,
            favorecidoNome: `Beneficiário (${parsed.bancoNome})`,
            favorecidoCnpjCpf: "",
            valor: parsed.valor,
            dataVencimento: parsed.dataVencimento || new Date().toISOString().split("T")[0],
            seuNumero: `PDF-TEXT-${boletosFound.length + 1}`,
            nossoNumero: "",
            bancoCodigo: parsed.bancoCodigo,
            bancoNome: parsed.bancoNome,
            observacoes: "Extraído via varredura contínua do PDF",
            confidence: 0.85,
          });
          break;
        }
      }
    }
  }

  return boletosFound;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow larger payload for PDF files uploaded as base64 (e.g. multi-page PDFs)
  app.use(express.json({ limit: "50mb" }));

  // API Route for PDF / Image Boleto extraction using Gemini with Local Fallback
  app.post("/api/extract-boleto-pdf", async (req, res) => {
    try {
      const { fileBase64, mimeType = "application/pdf", fileName = "boleto.pdf" } = req.body;

      if (!fileBase64) {
        return res.status(400).json({ error: "Conteúdo do arquivo em base64 não fornecido." });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      // Clean base64 and extract mimeType
      let cleanBase64 = fileBase64;
      let effectiveMimeType = mimeType || "application/pdf";

      const dataUriMatch = fileBase64.match(/^data:([^;]+);base64,(.*)$/s);
      if (dataUriMatch) {
        effectiveMimeType = dataUriMatch[1];
        cleanBase64 = dataUriMatch[2];
      } else {
        cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
      }

      if (effectiveMimeType.includes("pdf")) {
        effectiveMimeType = "application/pdf";
      }

      let boletosExtracted: any[] = [];

      // Tier 1: Gemini AI Optical Character Recognition & Parsing
      if (apiKey) {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const prompt = `Você é um especialista em OCR e análise financeira avançada para boletos bancários brasileiros, carnês de pagamento, parcelamentos, faturas, guias de arrecadação, tributos e GNRE.

Analise com MÁXIMA ATENÇÃO TODO O CONTEÚDO de TODAS AS PÁGINAS do arquivo enviado (${fileName}).

REGRAS OBRIGATÓRIAS PARA CARNÊS E MÚLTIPLOS BOLETOS (EX: SEGUROS, FINANCIAMENTOS, SUHAI):
1. O arquivo pode ser um CARNÊ com várias parcelas (ex: 12 parcelas de seguro Suhai / financiamento), onde cada página contém 2, 3 ou mais cupons/parcelas (por exemplo: Parcela 01/012 a Parcela 12/012).
2. CADA PARCELA É UM BOLETO INDIVIDUAL com sua própria data de vencimento (ex: 04/05/2026, 25/05/2026, 25/06/2026...), valor próprio (ex: R$ 49,32 ou R$ 49,35), nosso número e linha digitável.
3. Você DEVE PERCORRER TODAS AS PÁGINAS do PDF e extrair CADA UMA DAS PARCELAS como um boleto separado no array "boletos".
4. SE O CARNÊ TIVER 12 PARCELAS (01/012 até 12/012), VOCÊ DEVE RETORNAR EXATAMENTE 12 BOLETOS NO ARRAY! NUNCA pare na 1ª parcela e NUNCA retorne apenas 1 boleto se houver vários.
5. Para cada parcela:
   - "linhaDigitavel": Linha digitável completa de 47 dígitos (ex: 23793.39209 50005.692137 75020.156008 1 15200000004935). Se o texto da linha digitável de 47 dígitos estiver visível no topo ou lateral da parcela, extraia com precisão. Se para alguma parcela a linha digitável não estiver em texto corrido mas você tiver Banco (237 - Bradesco), Agência (3392), Conta (0201560-9), Carteira (05), Nosso Número (ex: 5/00056921372-8), Vencimento e Valor, forneça/monte a linha digitável de 47 dígitos correspondente.
   - "favorecidoNome": Nome do Beneficiário / Cedente (ex: "SUHAI SEGURADORA S/A").
   - "favorecidoCnpjCpf": CNPJ do Beneficiário se visível (ex: "16.825.255/0001-23").
   - "valor": Valor numérico exato do documento para ESTA PARCELA (ex: 49.32 ou 49.35). NUNCA retorne 0 se o valor estiver impresso na parcela.
   - "dataVencimento": Data de Vencimento de ESTA PARCELA no formato YYYY-MM-DD (ex: 2026-05-04, 2026-05-25, 2026-06-25, 2026-07-27, 2026-08-25, 2026-09-25, 2026-10-26, 2026-11-25, 2026-12-28, 2027-01-25, 2027-02-25, 2027-03-25).
   - "seuNumero": Identificação do documento ou parcela (ex: "1003111990090/00000000/01" ou "Parcela 01/012").
   - "nossoNumero": Nosso número do boleto (ex: "5/00056921372-8").
   - "bancoCodigo": Código de 3 dígitos do banco (ex: '237' para Bradesco, '001' para BB, '341' para Itaú, '104' para Caixa, '033' para Santander, '756' para Sicoob, '748' para Sicredi, '858' para GNRE, '856' para DARF).
   - "bancoNome": Nome do banco emissor (ex: "Bradesco").
   - "observacoes": Ex: "Parcela 01/012 de Suhai Seguradora".

DIFERENÇA CRÍTICA ENTRE DUPLICATAS DE MESMA VIA E PARCELAS DISTINTAS:
- Vias idênticas (1ª via e 2ª via da MESMA Parcela 01): ignore a duplicata e mantenha apenas uma.
- Parcelas diferentes (Parcela 01, Parcela 02, Parcela 03...): possuem Nosso Número e Vencimento DIFERENTES. Elas DEVEM SER EXTRAÍDAS TODAS!

REGRA DE SCHEMA JSON:
NUNCA retorne null ou undefined para nenhum campo!
Use 0 para numéricos não encontrados e '' para strings não encontradas.`;

        const callGeminiWithRetryAndFallback = async () => {
          const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
          let lastError: any = null;

          for (const modelName of modelsToTry) {
            try {
              console.log(`[Gemini API] Tentando extração com ${modelName}...`);
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
                    {
                      text: prompt,
                    },
                  ],
                },
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      boletos: {
                        type: Type.ARRAY,
                        description: "Lista de todos os boletos identificados no arquivo",
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            linhaDigitavel: { type: Type.STRING },
                            codigoBarras: { type: Type.STRING },
                            favorecidoNome: { type: Type.STRING },
                            favorecidoCnpjCpf: { type: Type.STRING },
                            valor: { type: Type.NUMBER },
                            dataVencimento: { type: Type.STRING },
                            seuNumero: { type: Type.STRING },
                            nossoNumero: { type: Type.STRING },
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
              return response;
            } catch (err: any) {
              lastError = err;
              console.warn(`[Gemini API] Erro ao tentar modelo ${modelName}:`, String(err?.message || err));
            }
          }
          throw lastError;
        };

        try {
          const response = await callGeminiWithRetryAndFallback();
          const rawText = response.text || "{}";
          let jsonText = rawText.trim();
          if (jsonText.startsWith("```json")) {
            jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
          } else if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
          }

          let parsedData: any = {};
          try {
            parsedData = JSON.parse(jsonText);
          } catch (parseErr) {
            console.error("Erro no parse JSON retornado pelo Gemini:", parseErr);
          }

          if (Array.isArray(parsedData.boletos)) {
            boletosExtracted = parsedData.boletos;
          } else if (parsedData.linhaDigitavel || parsedData.favorecidoNome) {
            boletosExtracted = [parsedData];
          }
        } catch (geminiError: any) {
          console.warn("[Gemini API] Falha na chamada Gemini, ativando fallback local por regex...", String(geminiError?.message || geminiError));
        }
      }

      // Tier 2: Local Stream & Decompressed Text Parser Fallback
      if (boletosExtracted.length === 0 && cleanBase64) {
        try {
          const buffer = Buffer.from(cleanBase64, "base64");
          const localBoletos = extractBoletosLocallyFromBuffer(buffer);
          if (localBoletos.length > 0) {
            console.log(`[Local PDF Parser] Sucesso! ${localBoletos.length} boleto(s) extraído(s) via fallback local.`);
            boletosExtracted = localBoletos;
          }
        } catch (fallbackErr) {
          console.error("Erro no fallback de extração local:", fallbackErr);
        }
      }

      // Post-process & sanitize all extracted boletos (especially GNRE / Tributos)
      boletosExtracted = boletosExtracted.map((b) => {
        const rawDigits = b.linhaDigitavel || b.codigoBarras || "";
        const cleanLinha = onlyNumbers(rawDigits);

        if (typeof b.valor === "string") {
          const cleanedVal = String(b.valor).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
          const parsedNum = parseFloat(cleanedVal);
          if (!isNaN(parsedNum)) b.valor = parsedNum;
        }

        // Sanitize and convert date formats like DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
        if (b.dataVencimento && typeof b.dataVencimento === 'string') {
          const ddmmyyyy = b.dataVencimento.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
          if (ddmmyyyy) {
            const [, day, month, year] = ddmmyyyy;
            b.dataVencimento = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }

        if (cleanLinha.length >= 44) {
          const parsedCheck = parseLinhaDigitavel(cleanLinha);
          if (parsedCheck.isValid) {
            b.linhaDigitavel = cleanLinha;
            b.codigoBarras = b.codigoBarras || parsedCheck.codigoBarras;
            b.bancoCodigo = parsedCheck.bancoCodigo || b.bancoCodigo || "000";
            b.bancoNome = parsedCheck.bancoNome || b.bancoNome;

            // If extracted valor is 0, use parsed value from linha digitável
            if (!b.valor || Number(b.valor) === 0) {
              b.valor = parsedCheck.valor;
            }
            if (parsedCheck.dataVencimento && (!b.dataVencimento || b.dataVencimento === '')) {
              b.dataVencimento = parsedCheck.dataVencimento;
            }
          }
        }
        return b;
      });

      // Deduplicate boletos by clean linhaDigitavel / codigoBarras (prevents 1st, 2nd, 3rd via duplication)
      const seenDigits = new Set<string>();
      const uniqueBoletos: typeof boletosExtracted = [];

      for (const b of boletosExtracted) {
        const rawDigits = b.linhaDigitavel || b.codigoBarras || "";
        const cleanDigits = onlyNumbers(rawDigits);

        if (cleanDigits && cleanDigits.length >= 10) {
          if (!seenDigits.has(cleanDigits)) {
            seenDigits.add(cleanDigits);
            uniqueBoletos.push(b);
          } else {
            console.log(`[OCR Server] Ignorando via/boleto duplicado com a mesma linha digitável: ${cleanDigits}`);
          }
        } else {
          uniqueBoletos.push(b);
        }
      }

      boletosExtracted = uniqueBoletos;

      return res.json({
        success: true,
        fileName,
        totalEncontrados: boletosExtracted.length,
        boletos: boletosExtracted,
      });
    } catch (error: any) {
      console.error("Erro geral na extração do boleto PDF:", error);
      const errStr = String(error?.message || error);
      return res.status(500).json({
        error: "Não foi possível extrair os dados do boleto PDF automaticamente.",
        details: errStr,
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
