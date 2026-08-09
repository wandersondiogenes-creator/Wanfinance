import React, { useState, useEffect, useMemo } from 'react';
import { BoletoItem, CompanyProfile, BankAccountProfile, CompanySettings, CNABBatchHistory, AuthUser } from './types';
import { testFirestoreConnection } from './lib/firebase';
import {
  fetchCompanyProfilesFromSupabase,
  fetchBoletosFromSupabase,
  fetchHistoryFromSupabase,
} from './lib/supabase';
import {
  loadCompanyProfiles,
  saveCompanyProfiles,
  loadActiveSelection,
  saveActiveSelection,
  getActiveCompanySettings,
  loadBoletos,
  saveBoletos,
  loadHistory,
  saveHistory,
  loadUserSession,
  saveUserSession,
} from './utils/storage';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { BoletoTable } from './components/BoletoTable';
import { ExecutionSidebar } from './components/ExecutionSidebar';
import { BoletoFormModal } from './components/BoletoFormModal';
import { BatchPasteModal } from './components/BatchPasteModal';
import { PDFBoletoImportModal } from './components/PDFBoletoImportModal';
import { CompanySettingsComponent } from './components/CompanySettings';
import { CNABPreviewModal } from './components/CNABPreviewModal';
import { SupabaseModal } from './components/SupabaseModal';
import { HistoryPanel } from './components/HistoryPanel';
import { CNABValidator } from './components/CNABValidator';
import { GoogleSheetsPanel } from './components/GoogleSheetsPanel';
import { BankPaymentApiPanel } from './components/BankPaymentApiPanel';
import { LearnedLayoutsAdminPanel } from './components/LearnedLayoutsAdminPanel';
import { ExtratoBancarioMainPanel } from './components/extrato/ExtratoBancarioMainPanel';
import { getBoletosDuplicateMap } from './utils/duplicateDetector';
import { validateAndClampPaymentDate } from './utils/boletoParser';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadUserSession);
  const [companies, setCompanies] = useState<CompanyProfile[]>(loadCompanyProfiles);
  const [activeSelection, setActiveSelection] = useState<{ companyId: string; bankId: string }>(loadActiveSelection);
  const [boletos, setBoletos] = useState<BoletoItem[]>(loadBoletos);
  const [history, setHistory] = useState<CNABBatchHistory[]>(loadHistory);

  useEffect(() => {
    testFirestoreConnection();

    // Check and load remote data from Supabase if configured
    async function initSupabaseData() {
      const cData = await fetchCompanyProfilesFromSupabase();
      if (cData && cData.length > 0) {
        setCompanies(cData);
      }
      const bData = await fetchBoletosFromSupabase();
      if (bData && bData.length > 0) {
        const cleaned = bData.filter((b) => !b?.id?.startsWith('bol-sample-'));
        setBoletos(cleaned);
      }
      const hData = await fetchHistoryFromSupabase();
      if (hData && hData.length > 0) {
        setHistory(hData);
      }
    }
    initSupabaseData();
  }, []);

  const handleReloadFromSupabase = (data: {
    companies?: CompanyProfile[];
    boletos?: BoletoItem[];
    history?: CNABBatchHistory[];
  }) => {
    if (data.companies && data.companies.length > 0) {
      setCompanies(data.companies);
    }
    if (data.boletos && data.boletos.length > 0) {
      setBoletos(data.boletos);
    }
    if (data.history && data.history.length > 0) {
      setHistory(data.history);
    }
  };

  const [activeTab, setActiveTab] = useState<
    'boletos' | 'novo_boleto' | 'empresa' | 'historico' | 'validador' | 'sheets' | 'api_pagamentos' | 'modelos_aprendidos' | 'extratos_bancarios'
  >('boletos');


  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  const [editingBoleto, setEditingBoleto] = useState<BoletoItem | null>(null);

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showToast = (
    text: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success'
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [sidebarFilterType, setSidebarFilterType] = useState<
    'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE'
  >('ALL');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const duplicatesMap = useMemo(() => getBoletosDuplicateMap(boletos, [], history), [boletos, history]);
  const duplicateCount = useMemo(() => {
    let count = 0;
    duplicatesMap.forEach((dup) => {
      if (dup.isDuplicate) count++;
    });
    return count;
  }, [duplicatesMap]);
  const overdueCount = useMemo(() => boletos.filter((b) => b.dataVencimento < todayStr).length, [boletos, todayStr]);
  const discountCount = useMemo(() => boletos.filter((b) => (b.desconto || 0) > 0).length, [boletos]);
  const interestCount = useMemo(() => boletos.filter((b) => (b.jurosMulta || 0) > 0).length, [boletos]);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    saveUserSession(user);
    showToast(`Bem-vindo à Wanfinance, ${user.name}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveUserSession(null);
    showToast('Sessão encerrada com sucesso.');
  };

  // Derived current CompanySettings object for CNAB generators & displays
  const activeCompanySettings: CompanySettings = getActiveCompanySettings(
    companies,
    activeSelection.companyId,
    activeSelection.bankId
  );

  // Sync state to LocalStorage
  useEffect(() => {
    saveBoletos(boletos);
  }, [boletos]);

  useEffect(() => {
    saveCompanyProfiles(companies);
  }, [companies]);

  useEffect(() => {
    saveActiveSelection(activeSelection.companyId, activeSelection.bankId);
  }, [activeSelection]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Company and Bank selection handlers
  const handleSelectCompany = (companyId: string) => {
    const targetComp = companies.find((c) => c.id === companyId);
    const targetBankId = targetComp ? (targetComp.activeBankId || (targetComp.bancos[0]?.id || '')) : '';
    setActiveSelection({ companyId, bankId: targetBankId });
  };

  const handleSelectBank = (bankId: string) => {
    setActiveSelection((prev) => ({ ...prev, bankId }));
  };

  const handleSaveCompanyProfiles = (
    updatedProfiles: CompanyProfile[],
    newActiveCompanyId?: string,
    newActiveBankId?: string
  ) => {
    setCompanies(updatedProfiles);
    if (newActiveCompanyId) {
      const comp = updatedProfiles.find((c) => c.id === newActiveCompanyId);
      const bId = newActiveBankId || (comp ? (comp.activeBankId || comp.bancos[0]?.id || '') : '');
      setActiveSelection({ companyId: newActiveCompanyId, bankId: bId });
    }
    showToast('Empresas e contas bancárias salvas com sucesso!');
  };

  // Handle Tab changes
  const handleTabChange = (
    tab: 'boletos' | 'novo_boleto' | 'empresa' | 'historico' | 'validador' | 'sheets'
  ) => {
    if (tab === 'novo_boleto') {
      setEditingBoleto(null);
      setIsFormModalOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  // Select handlers
  const handleToggleSelect = (id: string) => {
    setBoletos((prev) =>
      prev.map((b) => (b.id === id ? { ...b, selected: !b.selected } : b))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setBoletos((prev) => prev.map((b) => ({ ...b, selected: select })));
  };

  // Delete handlers
  const handleDeleteBoleto = (id: string) => {
    setBoletos((prev) => prev.filter((b) => b.id !== id));
    showToast('Boleto removido da lista.');
  };

  const handleDeleteSelected = () => {
    const selectedCount = boletos.filter((b) => b.selected).length;
    setBoletos((prev) => prev.filter((b) => !b.selected));
    showToast(`${selectedCount} boletos removidos.`);
  };

  const handleBatchUpdatePaymentDate = (newDate: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const selectedCount = boletos.filter((b) => b.selected).length;
    setBoletos((prev) =>
      prev.map((b) => {
        if (b.selected) {
          const clamped = validateAndClampPaymentDate(newDate, b.dataVencimento, todayStr);
          return { ...b, dataPagamento: clamped };
        }
        return b;
      })
    );
    showToast(`Data de pagamento alterada para ${selectedCount} boleto(s)!`);
  };

  // Save single boleto from modal
  const handleSaveBoleto = (boleto: BoletoItem) => {
    const boletoWithSelection = { ...boleto, selected: true };
    setBoletos((prev) => {
      const exists = prev.some((b) => b.id === boletoWithSelection.id);
      if (exists) {
        return prev.map((b) => (b.id === boletoWithSelection.id ? boletoWithSelection : b));
      }
      return [boletoWithSelection, ...prev];
    });
    showToast(editingBoleto ? 'Boleto atualizado!' : 'Novo boleto cadastrado e incluído no lote!');
    setEditingBoleto(null);
  };

  // Import batch boletos with automatic deduplication
  const handleImportBatchBoletos = (imported: BoletoItem[]) => {
    // 1. Internal deduplication of the imported batch
    const seenKeys = new Set<string>();
    const uniqueImported: BoletoItem[] = [];

    for (const item of imported) {
      const cleanKey = item.linhaDigitavel ? item.linhaDigitavel.replace(/\D/g, '') : '';
      if (cleanKey && cleanKey.length >= 40) {
        if (!seenKeys.has(cleanKey)) {
          seenKeys.add(cleanKey);
          uniqueImported.push(item);
        }
      } else {
        uniqueImported.push(item);
      }
    }

    const importedWithSelection = uniqueImported.map((b) => ({ ...b, selected: true }));

    setBoletos((prev) => {
      // 2. Filter out items that are exact duplicate of already existing boletos
      const existingKeys = new Set(
        prev
          .map((b) => (b.linhaDigitavel ? b.linhaDigitavel.replace(/\D/g, '') : ''))
          .filter((k) => k.length >= 40)
      );

      const nonDuplicateImported = importedWithSelection.filter((b) => {
        const key = b.linhaDigitavel ? b.linhaDigitavel.replace(/\D/g, '') : '';
        if (key && key.length >= 40) {
          return !existingKeys.has(key);
        }
        return true;
      });

      return [...nonDuplicateImported, ...prev];
    });

    showToast(`${uniqueImported.length} boleto(s) unificado(s) e incluído(s) no lote!`);
  };

  // Edit / Duplicate
  const handleEditBoleto = (boleto: BoletoItem) => {
    setEditingBoleto(boleto);
    setIsFormModalOpen(true);
  };

  const handleDuplicateBoleto = (boleto: BoletoItem) => {
    const duplicated: BoletoItem = {
      ...boleto,
      id: `bol-${Date.now()}`,
      seuNumero: `${boleto.seuNumero}-COPY`,
      createdAt: new Date().toISOString(),
    };
    setBoletos((prev) => [duplicated, ...prev]);
    showToast('Boleto duplicado!');
  };

  // Save batch to history when CNAB downloaded or processed
  const handleSaveToHistory = (
    fileContent: string,
    totalBoletos: number,
    totalValor: number,
    filename: string,
    nsa: number,
    analista?: string,
    removeExported: boolean = true,
    status: 'GERADO' | 'PROCESSADO' | 'ERRO' | 'PARCIAL' = 'GERADO',
    errorLogs: string[] = []
  ) => {
    const exportedBoletos = boletos.filter((b) => b.selected && b.isValid);
    const exportedIds = new Set(exportedBoletos.map((b) => b.id));
    const now = Date.now();

    const newBatch: CNABBatchHistory = {
      id: `batch-${now}`,
      userId: currentUser?.id || 'usr-default',
      userEmail: currentUser?.email || 'financeiro@wanfinance.com.br',
      analista: analista?.trim() || currentUser?.email || 'financeiro@wanfinance.com.br',
      nsa,
      filename,
      createdDate: new Date().toISOString(),
      timestamp: now,
      totalBoletos,
      totalValor,
      padraoCNAB: activeCompanySettings.padraoCNAB,
      bancoCodigo: activeCompanySettings.bancoCodigo,
      status,
      errorLogs,
      content: fileContent,
      boletos: exportedBoletos,
    };

    setHistory((prev) => [newBatch, ...prev]);

    if (removeExported) {
      // Automatically remove exported boletos from 'boletos a pagar'
      setBoletos((prev) => prev.filter((b) => !exportedIds.has(b.id)));
    }

    // Automatically increment NSA for active bank account
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id === activeSelection.companyId) {
          return {
            ...c,
            bancos: c.bancos.map((b) => {
              if (b.id === activeSelection.bankId) {
                return { ...b, nsa: b.nsa + 1 };
              }
              return b;
            }),
          };
        }
        return c;
      })
    );

    showToast(
      `Arquivo ${filename} gerado! ${exportedBoletos.length} boleto(s) processado(s)${
        removeExported ? ' e removido(s) de Boletos a Pagar' : ''
      }.`
    );
  };


  const selectedBoletos = boletos.filter((b) => b.selected && b.isValid);
  const totalSelectedValor = selectedBoletos.reduce(
    (acc, b) => acc + (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)),
    0
  );

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification - Colorful & Vivid */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce transition-all duration-300">
          <div
            className={`flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                : toastMessage.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
                : toastMessage.type === 'warning'
                ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30'
                : 'bg-blue-600 text-white border-blue-500 shadow-blue-600/30'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header & Tabs */}
      <Header
        company={activeCompanySettings}
        companies={companies}
        activeCompanyId={activeSelection.companyId}
        activeBankId={activeSelection.bankId}
        onSelectCompany={handleSelectCompany}
        onSelectBank={handleSelectBank}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        selectedBoletosCount={selectedBoletos.length}
        totalSelectedValor={totalSelectedValor}
        onQuickGenerateCNAB={() => setIsPreviewModalOpen(true)}
        onOpenPDFModal={() => setIsPDFModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Body Content */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {(activeTab === 'boletos' || activeTab === 'novo_boleto') && (
          <div className="w-full">
            {/* Main Area: Boletos Table or Insert Boletos Panel occupying full width */}
            <div className="w-full min-w-0">
              {activeTab === 'novo_boleto' ? (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                          Inserir e Colar Boletos a Pagar
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          Escolha o método mais rápido para importar boletos para o lote atual
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('boletos')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        ← Voltar para Boletos
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      {/* Option 1: PDF Extraction via IA */}
                      <div
                        onClick={() => setIsPDFModalOpen(true)}
                        className="bg-gradient-to-b from-blue-50 to-white border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md space-y-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900">1. Extrair PDF por IA</h3>
                        <p className="text-xs text-slate-600">
                          Envie um ou múltiplos arquivos PDF ou fotos de boletos. A Inteligência Artificial extrai favorecido, valor, vencimento e linha digitável.
                        </p>
                        <button className="text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-xl transition-colors">
                          Abrir Extrator PDF →
                        </button>
                      </div>

                      {/* Option 2: Colar em Lote */}
                      <div
                        onClick={() => setIsBatchModalOpen(true)}
                        className="bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md space-y-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900">2. Colar Múltiplos Boletos</h3>
                        <p className="text-xs text-slate-600">
                          Cole várias linhas digitáveis de uma só vez (uma por linha). O sistema calcula vencimento, banco e valida os dígitos verificadores.
                        </p>
                        <button className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-colors">
                          Colar em Lote →
                        </button>
                      </div>

                      {/* Option 3: Preencher Manual */}
                      <div
                        onClick={() => {
                          setEditingBoleto(null);
                          setIsFormModalOpen(true);
                        }}
                        className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-200 hover:border-amber-500 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md space-y-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900">3. Inserção Manual</h3>
                        <p className="text-xs text-slate-600">
                          Preencha individualmente o formulário completo com favorecido, código de barras/linha, valor, descontos, juros e ref.
                        </p>
                        <button className="text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-xl transition-colors">
                          Preencher Formulário →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Show Table Below for Convenience */}
                  <BoletoTable
                    boletos={boletos}
                    history={history}
                    filterType={sidebarFilterType}
                    setFilterType={setSidebarFilterType}
                    onToggleSelect={handleToggleSelect}
                    onSelectAll={handleSelectAll}
                    onDeleteBoleto={handleDeleteBoleto}
                    onDeleteSelected={handleDeleteSelected}
                    onEditBoleto={handleEditBoleto}
                    onDuplicateBoleto={handleDuplicateBoleto}
                    onOpenNewModal={() => {
                      setEditingBoleto(null);
                      setIsFormModalOpen(true);
                    }}
                    onOpenBatchModal={() => setIsBatchModalOpen(true)}
                    onOpenPDFModal={() => setIsPDFModalOpen(true)}
                    onGenerateCNAB={() => setIsPreviewModalOpen(true)}
                    onBatchUpdatePaymentDate={handleBatchUpdatePaymentDate}
                  />
                </div>
              ) : (
                <BoletoTable
                  boletos={boletos}
                  history={history}
                  filterType={sidebarFilterType}
                  setFilterType={setSidebarFilterType}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                  onDeleteBoleto={handleDeleteBoleto}
                  onDeleteSelected={handleDeleteSelected}
                  onEditBoleto={handleEditBoleto}
                  onDuplicateBoleto={handleDuplicateBoleto}
                  onOpenNewModal={() => {
                    setEditingBoleto(null);
                    setIsFormModalOpen(true);
                  }}
                  onOpenBatchModal={() => setIsBatchModalOpen(true)}
                  onOpenPDFModal={() => setIsPDFModalOpen(true)}
                  onGenerateCNAB={() => setIsPreviewModalOpen(true)}
                  onBatchUpdatePaymentDate={handleBatchUpdatePaymentDate}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'empresa' && (
          <CompanySettingsComponent
            companies={companies}
            activeCompanyId={activeSelection.companyId}
            activeBankId={activeSelection.bankId}
            onSaveCompanyProfiles={handleSaveCompanyProfiles}
            onSelectCompany={handleSelectCompany}
            onSelectBank={handleSelectBank}
          />
        )}

        {activeTab === 'historico' && (
          <HistoryPanel
            history={history}
            currentUser={currentUser}
            onClearHistory={() => {
              setHistory([]);
              saveHistory([]);
              showToast('Seu histórico foi totalmente limpo.');
            }}
            onDeleteHistoryItem={(id) => {
              setHistory((prev) => prev.filter((item) => item.id !== id));
              showToast('Registro do histórico excluído.');
            }}
            onDownloadBatch={(batch) => {
              const contentToDownload = batch.content || '';
              const blob = new Blob([contentToDownload], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = batch.filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              showToast(`Arquivo ${batch.filename} baixado novamente.`);
            }}
          />
        )}


        {activeTab === 'validador' && (
          <CNABValidator
            boletos={boletos}
            activeCompany={activeCompanySettings}
            currentUser={currentUser}
            onSaveToHistory={handleSaveToHistory}
            showToast={showToast}
          />
        )}

        {activeTab === 'sheets' && (
          <GoogleSheetsPanel
            boletos={boletos}
            history={history}
            onImportBoletos={handleImportBatchBoletos}
            showToast={showToast}
          />
        )}

        {activeTab === 'api_pagamentos' && (
          <BankPaymentApiPanel
            company={activeCompanySettings}
            boletos={boletos}
          />
        )}

        {activeTab === 'modelos_aprendidos' && (
          <LearnedLayoutsAdminPanel
            onShowToast={(msg) => showToast(msg, 'info')}
          />
        )}

        {activeTab === 'extratos_bancarios' && (
          <ExtratoBancarioMainPanel
            company={activeCompanySettings}
            onShowToast={(msg) => showToast(msg, 'success')}
          />
        )}
      </main>


      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 shadow-sm mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} <strong className="text-blue-700 font-bold">Wanfinance</strong> | Gerador CNAB de Pagamentos - FEBRABAN 240 / 400</p>
          <p className="text-slate-500">
            Suporte para múltiplos pagadores e bancos: Itaú, Bradesco, Banco do Brasil, Santander, Caixa, Sicoob, Sicredi e Inter.
          </p>
        </div>
      </footer>

      {/* Modals */}
      <BoletoFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveBoleto}
        initialData={editingBoleto}
        existingBoletos={boletos}
        history={history}
      />

      <BatchPasteModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onImportBoletos={handleImportBatchBoletos}
        existingBoletos={boletos}
        history={history}
      />

      <PDFBoletoImportModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        onImportBoletos={handleImportBatchBoletos}
        existingBoletos={boletos}
        history={history}
      />

      <CNABPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        company={activeCompanySettings}
        companies={companies}
        activeCompanyId={activeSelection.companyId}
        activeBankId={activeSelection.bankId}
        currentUser={currentUser}
        onSelectCompany={handleSelectCompany}
        onSelectBank={handleSelectBank}
        boletos={boletos}
        onToggleSelectBoleto={handleToggleSelect}
        onSelectAllBoletos={handleSelectAll}
        onOpenNewBoletoModal={() => {
          setEditingBoleto(null);
          setIsFormModalOpen(true);
        }}
        onSaveToHistory={handleSaveToHistory}
      />

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        companies={companies}
        boletos={boletos}
        history={history}
        onToast={(msg) => showToast(msg, 'success')}
        onReloadFromSupabase={handleReloadFromSupabase}
      />
    </div>
  );
}
