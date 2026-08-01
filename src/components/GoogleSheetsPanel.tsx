import React, { useState, useEffect } from 'react';
import { BoletoItem, CNABBatchHistory } from '../types';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
} from '../lib/googleAuth';
import {
  fetchUserSpreadsheets,
  getSpreadsheetDetails,
  getSpreadsheetValues,
  createWanfinanceSpreadsheet,
  appendBoletosToSpreadsheet,
  GoogleSpreadsheetItem,
  SheetTabInfo,
} from '../lib/googleSheetsApi';
import { parseLinhaDigitavel, formatCurrencyBRL } from '../utils/boletoParser';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  LogIn,
  LogOut,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  FileText,
} from 'lucide-react';

interface GoogleSheetsPanelProps {
  boletos: BoletoItem[];
  history: CNABBatchHistory[];
  onImportBoletos: (boletos: BoletoItem[]) => void;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  boletos,
  history,
  onImportBoletos,
  showToast,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // User spreadsheets list from Drive
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheetItem[]>([]);
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);

  // Active tab inside Google Sheets panel
  const [panelTab, setPanelTab] = useState<'export' | 'import' | 'history'>('export');

  // Export State
  const [exportMode, setExportMode] = useState<'new' | 'existing'>('new');
  const [newSheetTitle, setNewSheetTitle] = useState(
    `Wanfinance - Controle de Boletos (${new Date().toLocaleDateString('pt-BR')})`
  );
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [targetTabName, setTargetTabName] = useState<string>('Página1');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportedUrl, setLastExportedUrl] = useState<string | null>(null);

  // Import State
  const [importSource, setImportSource] = useState<'drive' | 'url'>('drive');
  const [importSpreadsheetId, setImportSpreadsheetId] = useState<string>('');
  const [customSheetUrl, setCustomSheetUrl] = useState<string>('');
  const [importTabs, setImportTabs] = useState<SheetTabInfo[]>([]);
  const [selectedImportTab, setSelectedImportTab] = useState<string>('');
  const [isLoadingSheetData, setIsLoadingSheetData] = useState(false);
  const [rawSheetRows, setRawSheetRows] = useState<string[][]>([]);

  // Column Mapping
  const [colLinha, setColLinha] = useState<number>(0);
  const [colFavorecido, setColFavorecido] = useState<number>(1);
  const [colValor, setColValor] = useState<number>(3);
  const [colVencimento, setColVencimento] = useState<number>(4);
  const [colPagamento, setColPagamento] = useState<number>(5);
  const [colSeuNumero, setColSeuNumero] = useState<number>(6);
  const [colObservacoes, setColObservacoes] = useState<number>(10);

  // Parsed imported boletos preview
  const [previewBoletos, setPreviewBoletos] = useState<BoletoItem[]>([]);

  // Initialize Auth state
  useEffect(() => {
    setIsLoadingAuth(true);
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setIsLoadingAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Drive Spreadsheets when token available
  const loadUserDriveSheets = async () => {
    if (!accessToken) return;
    setIsLoadingSpreadsheets(true);
    try {
      const files = await fetchUserSpreadsheets(accessToken);
      setSpreadsheets(files);
      if (files.length > 0 && !selectedSpreadsheetId) {
        setSelectedSpreadsheetId(files[0].id);
        setImportSpreadsheetId(files[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao buscar planilhas:', err);
      showToast('Não foi possível listar as planilhas do Google Drive.', 'error');
    } finally {
      setIsLoadingSpreadsheets(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadUserDriveSheets();
    }
  }, [accessToken]);

  // Handle Login
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast(`Conectado como ${result.user.displayName || result.user.email}`);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast(err.message || 'Falha ao conectar com o Google', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setAccessToken(null);
    setSpreadsheets([]);
    showToast('Desconectado do Google');
  };

  // Export Boletos to Google Sheets
  const handleExportToSheets = async () => {
    if (!accessToken) {
      showToast('Por favor, faça login com o Google primeiro.', 'error');
      return;
    }

    const boletosToExport =
      exportScope === 'selected'
        ? boletos.filter((b) => b.selected)
        : boletos;

    if (boletosToExport.length === 0) {
      showToast('Nenhum boleto selecionado para exportar.', 'error');
      return;
    }

    // Explicit confirmation dialog for data mutation in Google Workspace
    const confirmMsg =
      exportMode === 'new'
        ? `Deseja criar uma nova planilha "${newSheetTitle}" no seu Google Drive com ${boletosToExport.length} boleto(s)?`
        : `Deseja adicionar ${boletosToExport.length} boleto(s) na planilha selecionada?`;

    if (!window.confirm(confirmMsg)) return;

    setIsExporting(true);
    try {
      if (exportMode === 'new') {
        const result = await createWanfinanceSpreadsheet(
          accessToken,
          newSheetTitle,
          boletosToExport
        );
        setLastExportedUrl(result.spreadsheetUrl);
        showToast('Planilha criada com sucesso no Google Sheets!');
      } else {
        if (!selectedSpreadsheetId) {
          showToast('Selecione uma planilha do Google Drive.', 'error');
          setIsExporting(false);
          return;
        }
        await appendBoletosToSpreadsheet(
          accessToken,
          selectedSpreadsheetId,
          targetTabName || 'Página1',
          boletosToExport
        );
        const url = `https://docs.google.com/spreadsheets/d/${selectedSpreadsheetId}`;
        setLastExportedUrl(url);
        showToast('Boletos adicionados à planilha com sucesso!');
      }
      loadUserDriveSheets();
    } catch (err: any) {
      console.error('Export error:', err);
      showToast(err.message || 'Erro ao exportar para o Google Sheets', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Extract Spreadsheet ID from URL or input
  const extractSpreadsheetId = (urlOrId: string): string => {
    if (!urlOrId) return '';
    const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return urlOrId.trim();
  };

  // Load Sheet Data for Import
  const handleFetchSheetForImport = async () => {
    if (!accessToken) {
      showToast('Faça login com o Google primeiro.', 'error');
      return;
    }

    const targetId =
      importSource === 'url'
        ? extractSpreadsheetId(customSheetUrl)
        : importSpreadsheetId;

    if (!targetId) {
      showToast('Informe uma planilha válida do Google Sheets.', 'error');
      return;
    }

    setIsLoadingSheetData(true);
    try {
      const details = await getSpreadsheetDetails(accessToken, targetId);
      setImportTabs(details.sheets);
      const activeTab = details.sheets[0]?.title || 'Sheet1';
      setSelectedImportTab(activeTab);

      // Fetch values
      const rows = await getSpreadsheetValues(accessToken, targetId, `${activeTab}!A1:Z100`);
      setRawSheetRows(rows);

      if (rows.length > 1) {
        // Auto-detect header columns
        const headers = rows[0].map((h) => h.toLowerCase());
        headers.forEach((h, idx) => {
          if (h.includes('linha') || h.includes('barra') || h.includes('código') || h.includes('digitável')) setColLinha(idx);
          if (h.includes('favorecido') || h.includes('beneficiário') || h.includes('fornecedor') || h.includes('nome')) setColFavorecido(idx);
          if (h.includes('valor') || h.includes('preço') || h.includes('quantia')) setColValor(idx);
          if (h.includes('vencimento') || h.includes('venc')) setColVencimento(idx);
          if (h.includes('pagamento') || h.includes('pagto')) setColPagamento(idx);
          if (h.includes('seu número') || h.includes('nf') || h.includes('referência')) setColSeuNumero(idx);
          if (h.includes('obs') || h.includes('observa')) setColObservacoes(idx);
        });
      }

      showToast(`Planilha "${details.title}" carregada. ${rows.length} linhas encontradas.`);
    } catch (err: any) {
      console.error('Import fetch error:', err);
      showToast(err.message || 'Erro ao ler dados da planilha', 'error');
    } finally {
      setIsLoadingSheetData(false);
    }
  };

  // Generate preview of parsed boletos when raw rows or column mapping changes
  useEffect(() => {
    if (rawSheetRows.length <= 1) {
      setPreviewBoletos([]);
      return;
    }

    const dataRows = rawSheetRows.slice(1); // skip header row
    const items: BoletoItem[] = [];

    dataRows.forEach((row, idx) => {
      const rawLinha = row[colLinha] || '';
      const rawFavorecido = row[colFavorecido] || '';
      const rawValor = row[colValor] || '0';
      const rawVenc = row[colVencimento] || '';
      const rawPag = row[colPagamento] || '';
      const rawRef = row[colSeuNumero] || '';
      const rawObs = row[colObservacoes] || '';

      if (!rawLinha && !rawFavorecido) return; // empty row

      const parsed = parseLinhaDigitavel(rawLinha);

      // Clean numeric value
      let numVal = parsed.valor;
      if (rawValor && rawValor !== '0') {
        const cleanVal = String(rawValor)
          .replace(/[R$\s]/g, '')
          .replace(/\./g, '')
          .replace(',', '.');
        const parsedVal = parseFloat(cleanVal);
        if (!isNaN(parsedVal) && parsedVal > 0) {
          numVal = parsedVal;
        }
      }

      // Format Date
      let dueDate = parsed.dataVencimento || new Date().toISOString().split('T')[0];
      if (rawVenc) {
        if (rawVenc.includes('/')) {
          const parts = rawVenc.split('/');
          if (parts.length === 3) {
            dueDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (rawVenc.includes('-')) {
          dueDate = rawVenc;
        }
      }

      let payDate = dueDate;
      if (rawPag) {
        if (rawPag.includes('/')) {
          const parts = rawPag.split('/');
          if (parts.length === 3) {
            payDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (rawPag.includes('-')) {
          payDate = rawPag;
        }
      }

      items.push({
        id: `gsheet-${Date.now()}-${idx}`,
        linhaDigitavel: parsed.linhaDigitavelLimpa || rawLinha.replace(/\D/g, ''),
        codigoBarras: parsed.codigoBarras || rawLinha.replace(/\D/g, ''),
        bancoCodigo: parsed.bancoCodigo || '000',
        bancoNome: parsed.bancoNome || 'Importado Google Sheets',
        favorecidoNome: rawFavorecido || 'Favorecido Desconhecido',
        valor: numVal,
        dataVencimento: dueDate,
        dataPagamento: payDate,
        seuNumero: rawRef || `GS-${idx + 1}`,
        observacoes: rawObs ? `Google Sheets: ${rawObs}` : 'Importado via Google Sheets',
        isValid: parsed.isValid,
        validationError: parsed.errorMessage,
        selected: true,
        createdAt: new Date().toISOString(),
      });
    });

    setPreviewBoletos(items);
  }, [rawSheetRows, colLinha, colFavorecido, colValor, colVencimento, colPagamento, colSeuNumero, colObservacoes]);

  // Execute Import to App State
  const handleConfirmImport = () => {
    if (previewBoletos.length === 0) {
      showToast('Nenhum boleto válido para importar.', 'error');
      return;
    }

    onImportBoletos(previewBoletos);
    showToast(`${previewBoletos.length} boletos importados do Google Sheets!`);
    setRawSheetRows([]);
    setPreviewBoletos([]);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white">Integração Google Sheets</h2>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Oficial Workspace API
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Sincronize, exporte e importe seus boletos e relatórios de remessas diretamente com o Google Drive e Planilhas.
            </p>
          </div>
        </div>

        {/* Authentication Box */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shrink-0 w-full md:w-auto">
          {isLoadingAuth ? (
            <div className="flex items-center space-x-2 text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Verificando autenticação...</span>
            </div>
          ) : user ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-10 h-10 rounded-full border-2 border-emerald-500/50"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'G'}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>{user.displayName || 'Usuário Google'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-[11px] text-slate-400">{user.email}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl border border-slate-700 transition-colors"
                title="Desconectar da conta Google"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-100 text-slate-800 font-bold px-4 py-2.5 rounded-xl shadow border border-slate-200 transition-all text-xs"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Conectando...' : 'Entrar com o Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setPanelTab('export')}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            panelTab === 'export'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Exportar Boletos para Planilha</span>
        </button>

        <button
          onClick={() => setPanelTab('import')}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            panelTab === 'import'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Importar de uma Planilha</span>
        </button>

        <button
          onClick={() => setPanelTab('history')}
          className={`flex items-center space-x-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            panelTab === 'history'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Sincronizar Histórico CNAB</span>
        </button>
      </div>

      {/* PANEL TAB 1: EXPORT */}
      {panelTab === 'export' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
          {!accessToken && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-4 rounded-2xl flex items-center space-x-3 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
              <span>
                Para exportar dados diretamente para o Google Sheets, clique em <strong>"Entrar com o Google"</strong> no topo desta seção.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mode Selection */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Destino da Exportação
              </label>

              <div className="space-y-2">
                <label className="flex items-start space-x-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 cursor-pointer hover:border-emerald-500 transition-colors">
                  <input
                    type="radio"
                    name="exportMode"
                    value="new"
                    checked={exportMode === 'new'}
                    onChange={() => setExportMode('new')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-500" />
                      Criar Nova Planilha no Google Drive
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Gera um novo arquivo formatado com cabeçalhos e totais.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 cursor-pointer hover:border-emerald-500 transition-colors">
                  <input
                    type="radio"
                    name="exportMode"
                    value="existing"
                    checked={exportMode === 'existing'}
                    onChange={() => setExportMode('existing')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Anexar a uma Planilha Existente
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Adiciona as linhas ao final de uma planilha selecionada do seu Drive.
                    </p>
                  </div>
                </label>
              </div>

              {exportMode === 'new' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome da Nova Planilha:
                  </label>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Selecionar Planilha do Google Drive:
                    </label>
                    <select
                      value={selectedSpreadsheetId}
                      onChange={(e) => setSelectedSpreadsheetId(e.target.value)}
                      disabled={isLoadingSpreadsheets || spreadsheets.length === 0}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {spreadsheets.length === 0 ? (
                        <option value="">Nenhuma planilha encontrada no Drive</option>
                      ) : (
                        spreadsheets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Modificado: {new Date(s.modifiedTime || '').toLocaleDateString('pt-BR')})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Aba da Planilha (Ex: Página1):
                    </label>
                    <input
                      type="text"
                      value={targetTabName}
                      onChange={(e) => setTargetTabName(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Scope & Action */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Boletos a Exportar
              </label>

              <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="exportScope"
                    value="all"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Todos os Boletos ({boletos.length})</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="exportScope"
                    value="selected"
                    checked={exportScope === 'selected'}
                    onChange={() => setExportScope('selected')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Apenas Selecionados ({boletos.filter((b) => b.selected).length})</span>
                </label>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Estrutura dos Campos Exportados:
                </h4>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Linha Digitável, Código de Barras, Favorecido/Beneficiário, CNPJ/CPF, Valor (R$), Data de Vencimento, Data de Pagamento, Seu Número (NF/Ref), Banco e Observações.
                </p>
              </div>

              <button
                onClick={handleExportToSheets}
                disabled={isExporting || !accessToken}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-sm py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Exportando para o Google Sheets...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>Exportar {exportScope === 'selected' ? boletos.filter((b) => b.selected).length : boletos.length} Boleto(s)</span>
                  </>
                )}
              </button>

              {lastExportedUrl && (
                <a
                  href={lastExportedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors border border-emerald-500/30"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Planilha Criada no Google Sheets ↗</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL TAB 2: IMPORT */}
      {panelTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
          {!accessToken && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-4 rounded-2xl flex items-center space-x-3 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
              <span>
                Faça login com sua conta do Google acima para acessar e ler suas planilhas do Google Drive.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Import Source */}
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Selecionar Origem
              </label>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setImportSource('drive')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-colors ${
                    importSource === 'drive'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  Meus Arquivos no Drive
                </button>
                <button
                  onClick={() => setImportSource('url')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border transition-colors ${
                    importSource === 'url'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent'
                  }`}
                >
                  URL / ID da Planilha
                </button>
              </div>

              {importSource === 'drive' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Planilhas do seu Google Drive:
                  </label>
                  <select
                    value={importSpreadsheetId}
                    onChange={(e) => setImportSpreadsheetId(e.target.value)}
                    disabled={isLoadingSpreadsheets || spreadsheets.length === 0}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {spreadsheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cole a URL ou o ID da Planilha do Google:
                  </label>
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/1ABC.../edit"
                    value={customSheetUrl}
                    onChange={(e) => setCustomSheetUrl(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <button
                onClick={handleFetchSheetForImport}
                disabled={isLoadingSheetData || !accessToken}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition-colors cursor-pointer"
              >
                {isLoadingSheetData ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Lendo Planilha...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Carregar Dados da Planilha</span>
                  </>
                )}
              </button>
            </div>

            {/* Column Mapping */}
            <div className="md:col-span-2 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Mapeamento de Colunas (De/Para)
              </label>

              {rawSheetRows.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  Selecione uma planilha e clique em <strong>"Carregar Dados da Planilha"</strong> para visualizar e mapear as colunas.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Linha Digitável / Código de Barras:
                      </label>
                      <select
                        value={colLinha}
                        onChange={(e) => setColLinha(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-semibold text-slate-900 dark:text-white"
                      >
                        {rawSheetRows[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>
                            Col {idx + 1}: {col || `(Coluna ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Favorecido / Beneficiário:
                      </label>
                      <select
                        value={colFavorecido}
                        onChange={(e) => setColFavorecido(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-semibold text-slate-900 dark:text-white"
                      >
                        {rawSheetRows[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>
                            Col {idx + 1}: {col || `(Coluna ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Valor (R$):
                      </label>
                      <select
                        value={colValor}
                        onChange={(e) => setColValor(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-semibold text-slate-900 dark:text-white"
                      >
                        {rawSheetRows[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>
                            Col {idx + 1}: {col || `(Coluna ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Data Vencimento:
                      </label>
                      <select
                        value={colVencimento}
                        onChange={(e) => setColVencimento(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-semibold text-slate-900 dark:text-white"
                      >
                        {rawSheetRows[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>
                            Col {idx + 1}: {col || `(Coluna ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Data Pagamento:
                      </label>
                      <select
                        value={colPagamento}
                        onChange={(e) => setColPagamento(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-semibold text-slate-900 dark:text-white"
                      >
                        {rawSheetRows[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>
                            Col {idx + 1}: {col || `(Coluna ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Seu Número / NF Ref:
                      </label>
                      <select
                        value={colSeuNumero}
                        onChange={(e) => setColSeuNumero(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 font-semibold text-slate-900 dark:text-white"
                      >
                        {rawSheetRows[0]?.map((col, idx) => (
                          <option key={idx} value={idx}>
                            Col {idx + 1}: {col || `(Coluna ${idx + 1})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Pré-visualização dos Boletos Lidos ({previewBoletos.length} itens)
                      </span>
                      <button
                        onClick={handleConfirmImport}
                        disabled={previewBoletos.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-4 rounded-xl shadow transition-colors flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar {previewBoletos.length} Boletos à Wanfinance</span>
                      </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 font-bold">
                          <tr>
                            <th className="p-2">Linha Digitável</th>
                            <th className="p-2">Favorecido</th>
                            <th className="p-2">Valor</th>
                            <th className="p-2">Vencimento</th>
                            <th className="p-2">Validação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {previewBoletos.map((b, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-2 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                                {b.linhaDigitavel}
                              </td>
                              <td className="p-2 font-semibold text-slate-900 dark:text-white">
                                {b.favorecidoNome}
                              </td>
                              <td className="p-2 font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrencyBRL(b.valor)}
                              </td>
                              <td className="p-2 text-slate-600 dark:text-slate-400">
                                {b.dataVencimento}
                              </td>
                              <td className="p-2">
                                {b.isValid ? (
                                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    VÁLIDO
                                  </span>
                                ) : (
                                  <span className="bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    INVÁLIDO
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL TAB 3: HISTORY SYNC */}
      {panelTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" />
              Sincronização do Histórico de Remessas CNAB
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Exporte seus lotes de remessa CNAB gerados para um relatório consolidado no Google Sheets.
            </p>
          </div>

          {history.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhum lote de remessa CNAB foi gerado ainda. Crie sua primeira remessa na aba "Boletos a Pagar".
            </div>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {history.map((batch) => (
                  <div key={batch.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Lote NSA #{batch.nsa}</span>
                        <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          CNAB {batch.padraoCNAB}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {batch.filename} • {batch.totalBoletos} boletos • {formatCurrencyBRL(batch.totalValor)}
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (!accessToken) {
                          showToast('Faça login com o Google para exportar o relatório.', 'error');
                          return;
                        }
                        const confirmExport = window.confirm(`Deseja criar uma planilha do Google Sheets para o Lote NSA #${batch.nsa}?`);
                        if (!confirmExport) return;
                        try {
                          const res = await createWanfinanceSpreadsheet(
                            accessToken,
                            `Wanfinance - Lote CNAB NSA ${batch.nsa} (${new Date(batch.createdDate).toLocaleDateString('pt-BR')})`,
                            batch.boletos
                          );
                          window.open(res.spreadsheetUrl, '_blank');
                          showToast(`Planilha do Lote #${batch.nsa} gerada no Google Sheets!`);
                        } catch (err: any) {
                          showToast(err.message || 'Erro ao exportar lote', 'error');
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 px-4 rounded-xl shadow transition-colors flex items-center space-x-1.5 shrink-0"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Gerar Planilha deste Lote</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
