import React from 'react';
import { CompanySettings, CompanyProfile, AuthUser } from '../types';
import { getBankInfo } from '../utils/banks';
import {
  FileText,
  Building2,
  History,
  ShieldCheck,
  Download,
  Sparkles,
  Settings2,
  LogOut,
  Database,
  FileSpreadsheet,
  Zap,
  Brain,
  Layers,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  CheckCircle2,
  Clock,
  PlusCircle,
  FolderOpen
} from 'lucide-react';

export type AppTabType =
  | 'boletos'
  | 'novo_boleto'
  | 'empresa'
  | 'historico'
  | 'validador'
  | 'sheets'
  | 'api_pagamentos'
  | 'modelos_aprendidos'
  | 'extratos_bancarios';

interface AppleSidebarProps {
  activeTab: AppTabType;
  setActiveTab: (tab: AppTabType) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  company: CompanySettings;
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeBankId: string;
  onSelectCompany: (companyId: string) => void;
  onSelectBank: (bankId: string) => void;
  selectedBoletosCount: number;
  totalBoletosCount: number;
  totalSelectedValor: number;
  overdueCount: number;
  duplicateCount: number;
  onOpenPDFModal: () => void;
  onOpenBatchModal: () => void;
  onOpenNewModal: () => void;
  onOpenSupabaseModal?: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const AppleSidebar: React.FC<AppleSidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  setIsOpen,
  company,
  companies,
  activeCompanyId,
  activeBankId,
  onSelectCompany,
  onSelectBank,
  selectedBoletosCount,
  totalBoletosCount,
  totalSelectedValor,
  overdueCount,
  duplicateCount,
  onOpenPDFModal,
  onOpenBatchModal,
  onOpenNewModal,
  onOpenSupabaseModal,
  user,
  onLogout,
}) => {
  const currentCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];
  const companyBanks = currentCompany ? currentCompany.bancos : [];
  const currentBank = companyBanks.find((b) => b.id === activeBankId) || companyBanks[0];
  const bankInfo = getBankInfo(currentBank?.bancoCodigo || company.bancoCodigo);

  const mainNavItems = [
    {
      id: 'boletos' as AppTabType,
      label: 'Boletos a Pagar',
      icon: FileText,
      badge: totalBoletosCount > 0 ? totalBoletosCount : undefined,
      badgeColor: 'bg-blue-500 text-white',
      category: 'Principal',
    },
    {
      id: 'novo_boleto' as AppTabType,
      label: 'Inserir / Importar',
      icon: PlusCircle,
      category: 'Principal',
      action: onOpenNewModal,
    },
    {
      id: 'extratos_bancarios' as AppTabType,
      label: 'Extrato & DDA (Conciliação)',
      icon: Layers,
      badge: 'OFX/PDF',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold',
      category: 'Financeiro',
    },
    {
      id: 'historico' as AppTabType,
      label: 'Remessas Geradas',
      icon: History,
      category: 'Financeiro',
    },
    {
      id: 'validador' as AppTabType,
      label: 'Validador CNAB',
      icon: ShieldCheck,
      category: 'Ferramentas',
    },
    {
      id: 'sheets' as AppTabType,
      label: 'Google Sheets',
      icon: FileSpreadsheet,
      category: 'Ferramentas',
    },
    {
      id: 'api_pagamentos' as AppTabType,
      label: 'API Bancária Direta',
      icon: Zap,
      category: 'Avançado',
    },
    {
      id: 'modelos_aprendidos' as AppTabType,
      label: 'IA Aprendizado de Layouts',
      icon: Brain,
      category: 'Avançado',
    },
    {
      id: 'empresa' as AppTabType,
      label: 'Empresas & Contas',
      icon: Building2,
      category: 'Ajustes',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-[#f2f2f7]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border-r border-black/[0.08] dark:border-white/[0.08] flex flex-col transition-transform duration-300 ease-out select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${!isOpen ? 'lg:w-0 lg:border-none lg:overflow-hidden' : 'lg:w-72'}`}
      >
        {/* Apple iPad Top Sidebar Header with Traffic Lights & Logo */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center space-x-3">
            {/* iPadOS macOS Window Control Dots */}
            <div className="flex items-center space-x-1.5 mr-1 hidden sm:flex">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/50 shadow-2xs" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/50 shadow-2xs" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/50 shadow-2xs" />
            </div>

            {/* Apple Minimal App Icon */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/20">
              W
            </div>

            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1 leading-none">
                <span>Wanfinance</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-black/[0.05] dark:bg-white/[0.1] text-slate-500 dark:text-slate-400">
                  iPad Pro
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                CNAB {currentBank?.padraoCNAB || company.padraoCNAB} Pagfor
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors lg:hidden cursor-pointer"
            title="Fechar Barra Lateral"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button: Apple Pill Style "Extrair com IA" */}
        <div className="p-3">
          <button
            type="button"
            onClick={onOpenPDFModal}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold text-xs shadow-md shadow-blue-600/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Extrair PDF por IA</span>
          </button>
        </div>

        {/* Sidebar Nav Items Section */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6 no-scrollbar">
          {/* Group: Principal */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Principal
            </span>
            <div className="mt-1.5 space-y-0.5">
              {mainNavItems
                .filter((item) => item.category === 'Principal')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else {
                          setActiveTab(item.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-xs font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Group: Financeiro & Conciliação */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Financeiro & Remessas
            </span>
            <div className="mt-1.5 space-y-0.5">
              {mainNavItems
                .filter((item) => item.category === 'Financeiro')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-xs font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Group: Ferramentas */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ferramentas & Integrações
            </span>
            <div className="mt-1.5 space-y-0.5">
              {mainNavItems
                .filter((item) => item.category === 'Ferramentas' || item.category === 'Avançado')
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-500 text-white shadow-xs font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Group: Ajustes */}
          <div>
            <span className="px-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Configurações
            </span>
            <div className="mt-1.5 space-y-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('empresa')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'empresa'
                    ? 'bg-blue-500 text-white shadow-xs font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Building2 className={`w-4 h-4 ${activeTab === 'empresa' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>Empresas & Contas</span>
                </div>
              </button>

              {onOpenSupabaseModal && (
                <button
                  type="button"
                  onClick={onOpenSupabaseModal}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>Supabase Cloud Sync</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Card at bottom of Apple Sidebar */}
        {user && (
          <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] shadow-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {user.role}
                  </p>
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sair"
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
