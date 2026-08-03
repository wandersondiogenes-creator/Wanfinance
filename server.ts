import express from "express";
import path from "path";
import zlib from "zlib";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText } from "./src/utils/boletoParser";

/**
 * Local helper to extract text from PDF buffer, including zlib FlateDecode compressed streams
 */
function extractTextFromPdfBuffer(buffer: Buffer): string {
  let combinedText = "";

  // 1. Direct string view
  try {
    combinedText += buffer.toString("latin1") + " ";
  } catch (e) {
    // Ignore
  }

  // 2. Locate and inflate compressed streams safely without regex
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

  // Scan continuous digit stream if no matches yet (with safety limits for large PDF binary buffers)
  if (boletosFound.length === 0 && rawText.length < 500000) {
    const digitsOnly = onlyNumbers(rawText);
    const maxScan = Math.min(digitsOnly.length - 47, 10000);
    for (let i = 0; i <= maxScan; i++) {
      const chunk = digitsOnly.substring(i, i + 47);
      if (!seenLines.has(chunk)) {
        const parsed = parseLinhaDigitavel(chunk);
        if (parsed.isValid && parsed.valor > 0 && parsed.bancoCodigo !== '000') {
          seenLines.add(chunk);
          boletosFound.push({
            linhaDigitavel: chunk,
            codigoBarras: parsed.codigoBarras || chunk,
            favorecidoNome: extractFavorecidoFromText(rawText, parsed.bancoNome),
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
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // Express body-parser payload error handler to avoid HTTP 500 error pages
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error("[Express BodyParser Error]", err);
      return res.status(200).json({
        success: true,
        fileName: "boleto.pdf",
        totalEncontrados: 0,
        geminiApiError: `Aviso no servidor: ${err.message || err}`,
        boletos: [],
      });
    }
    next();
  });

  // API Route for PDF / Image Boleto extraction using Gemini with Local Fallback
  app.post("/api/extract-boleto-pdf", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { fileBase64, mimeType = "application/pdf", fileName = "boleto.pdf" } = body;

      if (!fileBase64 || typeof fileBase64 !== "string") {
        return res.status(200).json({
          success: true,
          fileName: fileName || "boleto.pdf",
          totalEncontrados: 0,
          geminiApiError: "Conteúdo do arquivo em base64 não fornecido.",
          boletos: [],
        });
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

      // Clean base64 and extract mimeType without running regex capture groups on megabytes of base64 data
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

      // Strip whitespace and linebreaks from base64 string
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
   - "favorecidoNome": NOME DA EMPRESA COBRADORA OU BENEFICIÁRIO/CEDENTE QUE ESTÁ EMITINDO A FATURA OU RECEBENDO O PAGAMENTO (ex: "SUHAI SEGURADORA S/A", "CLARO S.A.", "LOCALIZA"). REGRA VITAL: NUNCA COLOQUE O NOME DO BANCO EMISSOR (como "Bradesco", "Banco Itaú", "Banco do Brasil", "Caixa") NO CAMPO favorecidoNome! O banco é apenas a instituição financeira e vai SOMENTE no campo "bancoNome". Procure pela empresa indicada nos campos "Beneficiário", "Cedente", "Razão Social" ou no cabeçalho/logotipo do boleto.
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
          const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
          let lastError: any = null;

          for (const modelName of modelsToTry) {
            try {
              console.log(`[Gemini API] Tentando extração com ${modelName}...`);
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
                      {
                        text: prompt,
                      },
                    ],
                  },
                ],
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
          const rawText = response?.text || "{}";
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
          } else if (parsedData && (parsedData.linhaDigitavel || parsedData.favorecidoNome)) {
            boletosExtracted = [parsedData];
          }
        } catch (geminiError: any) {
          geminiApiError = String(geminiError?.message || geminiError);
          console.warn("[Gemini API] Falha na chamada Gemini, ativando fallback local por regex...", geminiApiError);
        }
      } else {
        geminiApiError = "GEMINI_API_KEY não configurada no servidor.";
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

      // Post-process & sanitize all extracted boletos safely
      if (!Array.isArray(boletosExtracted)) {
        boletosExtracted = [];
      }

      boletosExtracted = boletosExtracted
        .filter((b) => b && typeof b === "object")
        .map((b) => {
          const rawDigits = String(b.linhaDigitavel || b.codigoBarras || "");
          const cleanLinha = onlyNumbers(rawDigits);

          // Ensure favorecidoNome is the charging company and not the issuing bank
          let fav = String(b.favorecidoNome || "").trim();
          const bName = String(b.bancoNome || "").trim();
          const isBankName =
            !fav ||
            fav.toLowerCase().startsWith("banco") ||
            fav.toLowerCase().includes("bradesco") ||
            fav.toLowerCase().includes("itau") ||
            fav.toLowerCase().includes("itaú") ||
            fav.toLowerCase().includes("santander") ||
            fav.toLowerCase().includes("caixa econ") ||
            fav.toLowerCase().includes("sicoob") ||
            fav.toLowerCase().includes("sicredi") ||
            (bName && fav.toLowerCase() === bName.toLowerCase());

          if (isBankName) {
            let extractedCompany = "";
            try {
              const buffer = Buffer.from(cleanBase64, "base64");
              const rawPdfText = extractTextFromPdfBuffer(buffer);
              extractedCompany = extractFavorecidoFromText(rawPdfText, bName);
            } catch (err) {}

            if (extractedCompany && extractedCompany !== "Beneficiário / Cedente") {
              b.favorecidoNome = extractedCompany;
            } else {
              b.favorecidoNome = "Empresa Cobradora / Beneficiário";
            }
          }

          if (typeof b.valor === "string") {
            const cleanedVal = String(b.valor).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
            const parsedNum = parseFloat(cleanedVal);
            if (!isNaN(parsedNum)) b.valor = parsedNum;
          }

          // Sanitize and convert date formats like DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
          if (b.dataVencimento && typeof b.dataVencimento === "string") {
            const ddmmyyyy = b.dataVencimento.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
            if (ddmmyyyy) {
              const [, day, month, year] = ddmmyyyy;
              b.dataVencimento = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }
          }

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

              // If extracted valor is 0, use parsed value from linha digitável
              if (!b.valor || Number(b.valor) === 0) {
                b.valor = parsedCheck.valor;
              }
              if (parsedCheck.dataVencimento && (!b.dataVencimento || b.dataVencimento === "")) {
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
        const rawDigits = String(b.linhaDigitavel || b.codigoBarras || "");
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
        geminiApiError,
        boletos: boletosExtracted,
      });
    } catch (error: any) {
      console.error("Erro geral na extração do boleto PDF:", error);
      const errStr = String(error?.message || error);

      // Fail-safe emergency extraction directly from base64 buffer
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
        console.error("Erro na extração de emergência local:", fbErr);
      }

      return res.status(200).json({
        success: true,
        fileName: req.body?.fileName || "boleto.pdf",
        totalEncontrados: fallbackBoletos.length,
        geminiApiError: `Aviso no servidor: ${errStr}`,
        boletos: fallbackBoletos,
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
