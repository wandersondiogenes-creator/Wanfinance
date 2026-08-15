import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Check,
  Landmark,
  Layers,
  CreditCard
} from 'lucide-react';

interface HeaderProps {
  company: CompanySettings;
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeBankId: string;
  onSelectCompany: (companyId: string) => void;
  onSelectBank: (bankId: string) => void;
  activeTab: 'boletos' | 'novo_boleto' | 'empresa' | 'historico' | 'validador' | 'sheets' | 'api_pagamentos' | 'modelos_aprendidos' | 'extratos_bancarios';
  setActiveTab: (tab: 'boletos' | 'novo_boleto' | 'empresa' | 'historico' | 'validador' | 'sheets' | 'api_pagamentos' | 'modelos_aprendidos' | 'extratos_bancarios') => void;
  selectedBoletosCount: number;
  totalSelectedValor: number;
  onQuickGenerateCNAB: () => void;
  onOpenPDFModal: () => void;
  onOpenSupabaseModal?: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  company,
  companies,
  activeCompanyId,
  activeBankId,
  onSelectCompany,
  onSelectBank,
  activeTab,
  setActiveTab,
  selectedBoletosCount,
  totalSelectedValor,
  onQuickGenerateCNAB,
  onOpenPDFModal,
  onOpenSupabaseModal,
  user,
  onLogout,
}) => {
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false);
  const [isBankMenuOpen, setIsBankMenuOpen] = useState(false);

  const companyMenuRef = useRef<HTMLDivElement>(null);
  const bankMenuRef = useRef<HTMLDivElement>(null);

  const currentCompanyProfile = companies.find((c) => c.id === activeCompanyId) || companies[0];
  const companyBanks = currentCompanyProfile ? currentCompanyProfile.bancos : [];
  const currentBank = companyBanks.find((b) => b.id === activeBankId) || companyBanks[0];
  
  const bankInfo = getBankInfo(currentBank?.bancoCodigo || company.bancoCodigo);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyMenuRef.current && !companyMenuRef.current.contains(event.target as Node)) {
        setIsCompanyMenuOpen(false);
      }
      if (bankMenuRef.current && !bankMenuRef.current.contains(event.target as Node)) {
        setIsBankMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#0b0f17] text-slate-100 border-b border-slate-800/90 sticky top-0 z-40 shadow-2xl backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        {/* Top Bar: Brand, Company Status, Quick Actions & User Session */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3 gap-3.5">
          {/* Logo & Main Title */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* macOS Window Control Dots */}
            <div className="flex items-center space-x-1.5 shrink-0 hidden sm:flex">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40 shadow-2xs" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40 shadow-2xs" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40 shadow-2xs" />
            </div>

            {/* Apple Blue-Purple App Icon with W */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f86f7] via-[#5c6df6] to-[#a855f7] text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/25 shrink-0 select-none">
              W
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-base font-bold text-white tracking-tight">
                  Wanfinance
                </span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300 leading-none">
                  Pro
                </span>
              </div>
              <div className="mt-1">
                <span className="inline-flex items-center text-[11px] font-normal text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700/80 shadow-2xs leading-none">
                  Excellence
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Bar: Company & Bank Selectors + Utility Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active Company & Bank Selection Control Bar */}
            <div className="flex flex-wrap items-center gap-2 bg-[#121824] p-1.5 sm:p-2 rounded-2xl border border-slate-800 shadow-xl">
              
              {/* EMPRESA SELECTOR WITH DROPDOWN POPOVER */}
              <div className="relative" ref={companyMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCompanyMenuOpen(!isCompanyMenuOpen);
                    setIsBankMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2.5 bg-[#0a0e17] hover:bg-[#161f30] px-3 py-1.5 rounded-xl border transition-all text-left group cursor-pointer ${
                    isCompanyMenuOpen 
                      ? 'border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30' 
                      : 'border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 group-hover:text-amber-300 transition-colors">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 max-w-[170px] sm:max-w-[210px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Empresa Pagadora
                      </span>
                      <span className="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                        {companies.length} disp.
                      </span>
                    </div>
                    <span className="text-white font-bold text-xs truncate group-hover:text-amber-300 transition-colors leading-tight">
                      {currentCompanyProfile?.nomeFantasia || currentCompanyProfile?.razaoSocial || 'Selecionar Empresa'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-medium truncate">
                      {currentCompanyProfile?.cnpjCpf}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-transform shrink-0 ${isCompanyMenuOpen ? 'rotate-180 text-amber-400' : ''}`} />
                </button>

                {/* Company Dropdown Menu */}
                {isCompanyMenuOpen && (
                  <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#0f1523] border border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Selecionar Empresa ({companies.length})
                      </span>
                      <button
                        onClick={() => {
                          setIsCompanyMenuOpen(false);
                          setActiveTab('empresa');
                        }}
                        className="text-[11px] text-slate-400 hover:text-amber-400 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Settings2 className="w-3 h-3" /> Gerenciar
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 p-1 no-scrollbar">
                      {companies.map((c) => {
                        const isSelected = c.id === activeCompanyId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onSelectCompany(c.id);
                              setIsCompanyMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-xs'
                                : 'bg-[#141b2b] hover:bg-[#1c263c] border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {(c.nomeFantasia || c.razaoSocial).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                                  {c.nomeFantasia || c.razaoSocial}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400">
                                  {c.cnpjCpf} • {c.bancos?.length || 0} banco(s)
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 ml-2">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* BANCO SELECTOR WITH DROPDOWN POPOVER */}
              <div className="relative" ref={bankMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsBankMenuOpen(!isBankMenuOpen);
                    setIsCompanyMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2.5 bg-[#0a0e17] hover:bg-[#161f30] px-3 py-1.5 rounded-xl border transition-all text-left group cursor-pointer ${
                    isBankMenuOpen 
                      ? 'border-blue-500/80 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30' 
                      : 'border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-extrabold text-[11px] shadow-sm border border-white/20"
                    style={{ backgroundColor: bankInfo.color || '#EC0000' }}
                  >
                    {currentBank?.bancoCodigo || '033'}
                  </div>
                  <div className="flex flex-col min-w-0 max-w-[160px] sm:max-w-[195px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Conta Bancária
                      </span>
                      <span 
                        className="text-[9px] font-extrabold px-1.5 py-0.2 rounded border uppercase font-mono"
                        style={{ 
                          backgroundColor: `${bankInfo.color}25`, 
                          color: bankInfo.color === '#111827' ? '#93c5fd' : '#f8fafc',
                          borderColor: `${bankInfo.color}50`
                        }}
                      >
                        {bankInfo.shortName || 'Santander'}
                      </span>
                    </div>
                    <span className="text-white font-bold text-xs truncate group-hover:text-blue-300 transition-colors leading-tight">
                      {currentBank?.apelido || bankInfo.name}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <span>Ag: <strong className="text-slate-200">{currentBank?.agencia}</strong></span>
                      <span>•</span>
                      <span>Cc: <strong className="text-slate-200">{currentBank?.conta}{currentBank?.contaDV ? `-${currentBank.contaDV}` : ''}</strong></span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-transform shrink-0 ${isBankMenuOpen ? 'rotate-180 text-blue-400' : ''}`} />
                </button>

                {/* Bank Dropdown Menu */}
                {isBankMenuOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 sm:w-96 bg-[#0f1523] border border-slate-700/90 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                    <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5" /> Contas de {currentCompanyProfile?.nomeFantasia || 'Empresa'} ({companyBanks.length})
                      </span>
                      <button
                        onClick={() => {
                          setIsBankMenuOpen(false);
                          setActiveTab('empresa');
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-400 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Settings2 className="w-3 h-3" /> Gerenciar
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 p-1 no-scrollbar">
                      {companyBanks.map((b) => {
                        const isSelected = b.id === activeBankId;
                        const bInfo = getBankInfo(b.bancoCodigo);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              onSelectBank(b.id);
                              setIsBankMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-500/15 border-blue-500/50 text-white shadow-xs'
                                : 'bg-[#141b2b] hover:bg-[#1c263c] border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs border border-white/20"
                                style={{ backgroundColor: bInfo.color }}
                              >
                                {b.bancoCodigo}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                                    {b.apelido || bInfo.name}
                                  </p>
                                  <span className="bg-slate-800 text-slate-300 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                                    CNAB {b.padraoCNAB}
                                  </span>
                                </div>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  Ag: <strong className="text-slate-200">{b.agencia}</strong> • Cc: <strong className="text-slate-200">{b.conta}{b.contaDV ? `-${b.contaDV}` : ''}</strong> • NSA #{b.bancoCodigo === '033' && (b.nsa || 1) < 11 ? 11 : b.nsa}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 ml-2">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Manage Companies & Accounts Button */}
              <button
                onClick={() => setActiveTab('empresa')}
                title="Cadastrar / Gerenciar Empresas e Bancos"
                className="bg-[#0a0e17] hover:bg-slate-800 text-slate-300 hover:text-amber-400 p-2.5 rounded-xl border border-slate-700/80 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <Settings2 className="w-4 h-4 text-amber-400" />
                <span className="hidden xl:inline text-xs font-bold">Gerenciar</span>
              </button>

              {/* Supabase Integration Button */}
              {onOpenSupabaseModal && (
                <button
                  onClick={onOpenSupabaseModal}
                  title="Integração & Migrations Supabase"
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-2 px-2.5 rounded-xl border border-emerald-500/30 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="hidden xl:inline text-xs font-bold">Supabase</span>
                </button>
              )}
            </div>

            {/* Logged User Info & Logout Button */}
            {user && (
              <div className="flex items-center space-x-2 bg-[#121824] border border-slate-800 p-1.5 px-3 rounded-2xl text-xs shadow-lg">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-bold text-white leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold leading-tight">
                    {user.role}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Encerrar Sessão / Sair"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all ml-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Quick Generate Action Button if boletos selected */}
            {selectedBoletosCount > 0 && (
              <button
                onClick={onQuickGenerateCNAB}
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Gerar CNAB ({selectedBoletosCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Modern Executive Gold Theme */}
        <div className="flex space-x-1 border-t border-slate-800/80 pt-2 overflow-x-auto no-scrollbar">
          {/* Boletos a Pagar Tab */}
          <button
            onClick={() => setActiveTab('boletos')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'boletos'
                ? 'bg-[#1a2334] text-amber-400 border-b-2 border-amber-500 shadow-xs'
                : 'text-slate-400 hover:text-amber-400 hover:bg-[#131a27]'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Boletos a Pagar</span>
            {selectedBoletosCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black">
                {selectedBoletosCount}
              </span>
            )}
          </button>

          {/* Extrair PDF (IA) Button */}
          <button
            onClick={onOpenPDFModal}
            className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-amber-300 bg-gradient-to-r from-amber-500/20 via-amber-500/30 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-500/40 border border-amber-500/40 rounded-t-xl transition-all whitespace-nowrap shadow-md shadow-amber-500/10 cursor-pointer animate-pulse"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Extrair PDF (IA)</span>
          </button>

          {/* Dados da Empresa & Banco Tab */}
          <button
            onClick={() => setActiveTab('empresa')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'empresa'
                ? 'bg-[#1a2334] text-amber-400 border-b-2 border-amber-500 shadow-xs'
                : 'text-slate-400 hover:text-amber-400 hover:bg-[#131a27]'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-500" />
            <span>Empresa & Banco</span>
          </button>

          {/* Remessas Geradas Tab */}
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'historico'
                ? 'bg-indigo-950/60 text-indigo-300 border-b-2 border-indigo-500 shadow-xs'
                : 'text-slate-400 hover:text-indigo-400 hover:bg-[#131a27]'
            }`}
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span>Remessas Geradas</span>
          </button>

          {/* Validador CNAB Tab */}
          <button
            onClick={() => setActiveTab('validador')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'validador'
                ? 'bg-teal-950/60 text-teal-300 border-b-2 border-teal-500 shadow-xs'
                : 'text-slate-400 hover:text-teal-400 hover:bg-[#131a27]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Validador CNAB</span>
          </button>

          {/* API de Pagamentos (Direct Bank) Tab */}
          <button
            onClick={() => setActiveTab('api_pagamentos')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'api_pagamentos'
                ? 'bg-amber-950/80 text-amber-300 border-b-2 border-amber-500 shadow-xs'
                : 'text-slate-400 hover:text-amber-400 hover:bg-[#131a27]'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>API de Pagamentos</span>
            <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase border border-amber-500/30">
              Direto Banco
            </span>
          </button>

          {/* Extratos CNAB Tab */}
          <button
            onClick={() => setActiveTab('extratos_bancarios')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'extratos_bancarios'
                ? 'bg-emerald-950/80 text-emerald-300 border-b-2 border-emerald-500 shadow-xs'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-[#131a27]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Extratos CNAB</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase border border-emerald-500/30">
              Novo
            </span>
          </button>

          {/* Modelos Aprendidos (Continuous Learning AI) Tab */}
          <button
            onClick={() => setActiveTab('modelos_aprendidos')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'modelos_aprendidos'
                ? 'bg-purple-950/80 text-purple-300 border-b-2 border-purple-500 shadow-xs'
                : 'text-slate-400 hover:text-purple-300 hover:bg-[#131a27]'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Modelos Aprendidos</span>
            <span className="bg-purple-500/20 text-purple-300 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase border border-purple-500/30">
              IA Contínua
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
