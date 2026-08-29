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
import { AppleSidebar, AppTabType } from './components/AppleSidebar';
import { AppleTopNav } from './components/AppleTopNav';
import { AppleCompanyBankBar } from './components/AppleCompanyBankBar';
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
import { SmartExtractionPanel } from './components/smartExtractor/SmartExtractionPanel';
import { getBoletosDuplicateMap } from './utils/duplicateDetector';
import { validateAndClampPaymentDate } from './utils/boletoParser';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

import { syncLearnedLayoutsFromCloud } from './utils/layoutLearningEngine';
import { syncLearnedCorrectionsFromCloud } from './utils/correctionsMemoryEngine';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(loadUserSession);
  const [companies, setCompanies] = useState<CompanyProfile[]>(loadCompanyProfiles);
  const [activeSelection, setActiveSelection] = useState<{ companyId: string; bankId: string }>(loadActiveSelection);
  const [boletos, setBoletos] = useState<BoletoItem[]>(loadBoletos);
  const [history, setHistory] = useState<CNABBatchHistory[]>(loadHistory);

  useEffect(() => {
    testFirestoreConnection();
    syncLearnedLayoutsFromCloud();
    syncLearnedCorrectionsFromCloud();

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

  const [activeTab, setActiveTab] = useState<AppTabType>('boletos');


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
    'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE' | 'HIGH_VALUE'
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
                const currentNsa = b.bancoCodigo === '033' && (b.nsa || 1) < 11 ? 11 : (b.nsa || 1);
                return { ...b, nsa: currentNsa + 1 };
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


  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Tab Title Map for Apple Top Navigation Bar
  const tabTitles: Record<AppTabType, { title: string; subtitle: string }> = {
    boletos: { title: 'Boletos a Pagar', subtitle: 'Lote de Pagamentos' },
    extracao_inteligente: { title: 'Extração Inteligente Multi-Documentos', subtitle: 'Novo Módulo Especializado & Auditoria de Validação' },
    novo_boleto: { title: 'Importar / Inserir Boletos', subtitle: 'Entrada de Dados' },
    empresa: { title: 'Empresas & Contas Bancárias', subtitle: 'Configurações de Pagador' },
    historico: { title: 'Remessas Geradas', subtitle: 'Histórico & Arquivos CNAB' },
    validador: { title: 'Validador CNAB FEBRABAN', subtitle: 'Conformidade Técnica' },
    sheets: { title: 'Integração Google Sheets', subtitle: 'Sincronização de Planilhas' },
    api_pagamentos: { title: 'API Bancária Direta', subtitle: 'Conexão Santander & Itaú' },
    modelos_aprendidos: { title: 'Modelos de Boletos Aprendidos', subtitle: 'IA de Reconhecimento' },
    extratos_bancarios: { title: 'Extrato & DDA Bancário', subtitle: 'Conciliação Automática' },
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
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] flex font-sans selection:bg-blue-500 selection:text-white">
      {/* Apple Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold backdrop-blur-2xl ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600/90 text-white border-emerald-500/50 shadow-emerald-600/30'
                : toastMessage.type === 'error'
                ? 'bg-rose-600/90 text-white border-rose-500/50 shadow-rose-600/30'
                : toastMessage.type === 'warning'
                ? 'bg-amber-500/90 text-white border-amber-400/50 shadow-amber-500/30'
                : 'bg-blue-600/90 text-white border-blue-500/50 shadow-blue-600/30'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-white" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-200" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* iPadOS Sidebar Component */}
      <AppleSidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'novo_boleto') {
            setEditingBoleto(null);
            setIsFormModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        company={activeCompanySettings}
        companies={companies}
        activeCompanyId={activeSelection.companyId}
        activeBankId={activeSelection.bankId}
        onSelectCompany={handleSelectCompany}
        onSelectBank={handleSelectBank}
        selectedBoletosCount={selectedBoletos.length}
        totalBoletosCount={boletos.length}
        totalSelectedValor={totalSelectedValor}
        overdueCount={overdueCount}
        duplicateCount={duplicateCount}
        onOpenPDFModal={() => setIsPDFModalOpen(true)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenNewModal={() => {
          setEditingBoleto(null);
          setIsFormModalOpen(true);
        }}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        user={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area with Adaptive Left Margin for Sidebar */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-72' : 'lg:pl-0'}`}>
        {/* Apple Top Navigation Bar */}
        <AppleTopNav
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          title={tabTitles[activeTab]?.title || 'Wanfinance'}
          subtitle={tabTitles[activeTab]?.subtitle}
          selectedBoletosCount={selectedBoletos.length}
          totalSelectedValor={totalSelectedValor}
          onQuickGenerateCNAB={() => setIsPreviewModalOpen(true)}
          onOpenPDFModal={() => setIsPDFModalOpen(true)}
          onOpenBatchModal={() => setIsBatchModalOpen(true)}
          onOpenNewModal={() => {
            setEditingBoleto(null);
            setIsFormModalOpen(true);
          }}
          activeTab={activeTab}
        />

        {/* Apple Company & Bank Bar */}
        <AppleCompanyBankBar
          company={activeCompanySettings}
          companies={companies}
          activeCompanyId={activeSelection.companyId}
          activeBankId={activeSelection.bankId}
          onSelectCompany={handleSelectCompany}
          onSelectBank={handleSelectBank}
          onManageCompanies={() => setActiveTab('empresa')}
        />

        {/* Apple iPad Main Stage Content Container */}
        <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {(activeTab === 'boletos' || activeTab === 'novo_boleto') && (
            <div className="w-full">
              {/* Main Area: Boletos Table or Insert Boletos Panel occupying full width */}
              <div className="w-full min-w-0">
                {activeTab === 'novo_boleto' ? (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-6 shadow-sm backdrop-blur-2xl">
                      <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                            Inserir e Colar Boletos a Pagar
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            Escolha o método mais rápido para importar boletos para o lote atual
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('boletos')}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          ← Voltar para Boletos
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                        {/* Option 0: Nova Aba Extração Inteligente */}
                        <div
                          onClick={() => setActiveTab('extracao_inteligente')}
                          className="bg-gradient-to-b from-blue-500/10 to-indigo-500/10 dark:from-blue-500/15 dark:to-indigo-500/15 border-2 border-blue-500/50 hover:border-blue-500 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg space-y-3 apple-card-hover relative"
                        >
                          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                            Nova Aba
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/30">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Extração Inteligente Multi-Doc</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Módulo avançado com seleção de categoria (Montadoras/FIDC, DETRAN, DARF, GRU, GNRE) e auditoria visual de validação.
                          </p>
                          <button className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl transition-colors shadow-xs">
                            Acessar Nova Aba →
                          </button>
                        </div>

                        {/* Option 1: PDF Extraction Tradicional */}
                        <div
                          onClick={() => setIsPDFModalOpen(true)}
                          className="bg-white dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.08] hover:border-blue-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md space-y-3 apple-card-hover"
                        >
                          <div className="w-10 h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                            <Sparkles className="w-5 h-5 text-blue-500" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Extrator PDF Tradicional</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Extrator rápido clássico em janela modal. Mantido 100% intacto para compatibilidade total.
                          </p>
                          <button className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.06] px-3 py-1.5 rounded-xl transition-colors">
                            Abrir Extrator Clássico →
                          </button>
                        </div>

                        {/* Option 2: Colar em Lote */}
                        <div
                          onClick={() => setIsBatchModalOpen(true)}
                          className="bg-white dark:bg-[#2c2c2e] border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md space-y-3 apple-card-hover"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-500/20">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">2. Colar Múltiplos Boletos</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Cole várias linhas digitáveis de uma vez. O sistema calcula vencimento, banco e valida os dígitos verificadores.
                          </p>
                          <button className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-3 py-1.5 rounded-xl transition-colors">
                            Colar em Lote →
                          </button>
                        </div>

                        {/* Option 3: Preencher Manual */}
                        <div
                          onClick={() => {
                            setEditingBoleto(null);
                            setIsFormModalOpen(true);
                          }}
                          className="bg-white dark:bg-[#2c2c2e] border border-amber-500/20 hover:border-amber-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-md space-y-3 apple-card-hover"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/20">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">3. Inserção Manual</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Preencha individualmente o formulário completo com favorecido, código de barras, valor, descontos e juros.
                          </p>
                          <button className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 px-3 py-1.5 rounded-xl transition-colors">
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
                      onOpenSmartExtractor={() => setActiveTab('extracao_inteligente')}
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
                    onOpenSmartExtractor={() => setActiveTab('extracao_inteligente')}
                    onGenerateCNAB={() => setIsPreviewModalOpen(true)}
                    onBatchUpdatePaymentDate={handleBatchUpdatePaymentDate}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'extracao_inteligente' && (
            <SmartExtractionPanel
              company={activeCompanySettings}
              companies={companies}
              onImportBoletosToMainList={(newBoletos) => {
                handleImportBatchBoletos(newBoletos);
                setActiveTab('boletos');
              }}
              onOpenTraditionalExtractor={() => setIsPDFModalOpen(true)}
              onShowToast={(msg, type) => showToast(msg, type)}
              onSaveToHistory={handleSaveToHistory}
            />
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

        {/* Apple iPad Clean Footer */}
        <footer className="border-t border-black/[0.06] dark:border-white/[0.08] py-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-[#1c1c1e]/50 backdrop-blur-xl mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© {new Date().getFullYear()} <strong className="font-semibold text-slate-800 dark:text-slate-200">Wanfinance CNAB</strong> • iPadOS Design System</p>
            <p className="text-slate-400 text-[11px]">
              Multi-empresa & FEBRABAN CNAB 240 / 400 (Santander, Itaú, Bradesco, BB, Caixa, Sicoob, Sicredi, Inter)
            </p>
          </div>
        </footer>
      </div>


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
