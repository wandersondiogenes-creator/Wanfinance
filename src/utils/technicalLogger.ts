export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  step: string;
  fileName?: string;
  fileSize?: number;
  endpoint?: string;
  httpStatus?: number | string;
  errorMessage?: string;
  backendResponse?: string;
  processingTimeMs?: number;
  details?: any;
  severity: 'info' | 'warn' | 'error';
}

class TechnicalLogger {
  private logs: DiagnosticLogEntry[] = [];
  private maxLogs = 200;

  public log(entry: Omit<DiagnosticLogEntry, 'id' | 'timestamp'>): DiagnosticLogEntry {
    const fullEntry: DiagnosticLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const consolePrefix = `[TechnicalLog][${fullEntry.step}]`;
    const detailsObj = {
      arquivo: fullEntry.fileName || 'N/A',
      tamanho: fullEntry.fileSize ? `${(fullEntry.fileSize / 1024).toFixed(1)} KB` : 'N/A',
      endpoint: fullEntry.endpoint || 'N/A',
      httpStatus: fullEntry.httpStatus ?? 'N/A',
      tempo: fullEntry.processingTimeMs ? `${fullEntry.processingTimeMs}ms` : 'N/A',
      mensagem: fullEntry.errorMessage || 'Sucesso',
      resposta: fullEntry.backendResponse || 'N/A',
      detalhes: fullEntry.details,
    };

    if (fullEntry.severity === 'error') {
      console.error(`${consolePrefix} ❌ ERRO:`, fullEntry.errorMessage, detailsObj);
    } else if (fullEntry.severity === 'warn') {
      console.warn(`${consolePrefix} ⚠️ AVISO:`, fullEntry.errorMessage, detailsObj);
    } else {
      console.info(`${consolePrefix} ℹ️ INFO:`, fullEntry.errorMessage || 'Etapa concluída', detailsObj);
    }

    return fullEntry;
  }

  public getLogs(): DiagnosticLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public exportLogsAsString(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const technicalLogger = new TechnicalLogger();
if (typeof window !== 'undefined') {
  (window as any).__TECHNICAL_LOGGER__ = technicalLogger;
}
