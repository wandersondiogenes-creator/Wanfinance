import React from 'react';
import { CompanySettings, CompanyProfile, AuthUser } from '../types';
import { getBankInfo } from '../utils/banks';
import { FileText, Building2, PlusCircle, History, ShieldCheck, Download, Sparkles, Settings2, LogOut, Database, FileSpreadsheet } from 'lucide-react';

interface HeaderProps {
  company: CompanySettings;
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeBankId: string;
  onSelectCompany: (companyId: string) => void;
  onSelectBank: (bankId: string) => void;
  activeTab: 'boletos' | 'novo_boleto' | 'empresa' | 'historico' | 'validador' | 'sheets';
  setActiveTab: (tab: 'boletos' | 'novo_boleto' | 'empresa' | 'historico' | 'validador' | 'sheets') => void;
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
  const bankInfo = getBankInfo(company.bancoCodigo);

  const currentCompanyProfile = companies.find((c) => c.id === activeCompanyId) || companies[0];
  const companyBanks = currentCompanyProfile ? currentCompanyProfile.bancos : [];

  return (
    <header className="bg-[#0f141d] text-slate-100 border-b border-slate-800 sticky top-0 z-30 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar: Brand, Company Status, Quick Actions & User Session */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3.5 gap-4">
          <div className="flex items-center space-x-3.5 shrink-0">
            {/* Geometric Golden W Logo */}
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 border border-amber-300/40">
              <svg viewBox="0 0 100 100" className="w-6 h-6 text-slate-950 fill-current font-black">
                <path d="M15 25 L35 75 L50 45 L65 75 L85 25 L70 25 L60 55 L50 35 L40 55 L30 25 Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-tight uppercase flex items-center gap-1">
                  <span className="text-white">WAN</span>
                  <span className="text-[#E5A93C]">FINANCE</span>
                  <span className="text-slate-600 font-normal ml-1">|</span>
                  <span className="text-slate-200 text-base font-bold ml-1">CNAB</span>
                </h1>
                <span className="bg-amber-500/10 text-amber-400 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  CNAB {company.padraoCNAB}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Gestão Financeira & Remessas Bancárias
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Active Company & Bank Selection Control Bar */}
            <div className="flex flex-wrap items-center gap-2.5 bg-[#161d2a] p-2 rounded-2xl border border-slate-880 text-xs">
              {/* Empresa Dropdown */}
              <div className="flex items-center space-x-2 bg-[#0d121c] px-2.5 py-1.5 rounded-xl border border-slate-700/80 shadow-inner">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Empresa Pagadora:
                  </span>
                  <select
                    value={activeCompanyId}
                    onChange={(e) => onSelectCompany(e.target.value)}
                    className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#161d2a] text-white">
                        {c.nomeFantasia || c.razaoSocial} ({c.cnpjCpf})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Banco Dropdown */}
              <div className="flex items-center space-x-2 bg-[#0d121c] px-2.5 py-1.5 rounded-xl border border-slate-700/80 shadow-inner">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: bankInfo.color }}
                ></div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Conta Bancária:
                  </span>
                  <select
                    value={activeBankId}
                    onChange={(e) => onSelectBank(e.target.value)}
                    className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {companyBanks.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#161d2a] text-white">
                        {b.apelido} [Ag: {b.agencia} / Cc: {b.conta}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Manage Companies button */}
              <button
                onClick={() => setActiveTab('empresa')}
                title="Cadastrar / Gerenciar Empresas e Bancos"
                className="bg-[#0d121c] hover:bg-slate-800 text-slate-300 hover:text-amber-400 p-2 rounded-xl border border-slate-700/80 transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
              >
                <Settings2 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline text-xs font-semibold">Gerenciar</span>
              </button>

              {/* Supabase Button */}
              {onOpenSupabaseModal && (
                <button
                  onClick={onOpenSupabaseModal}
                  title="Integração & Migrations Supabase"
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-2 px-2.5 rounded-xl border border-emerald-500/30 transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline text-xs font-bold">Supabase</span>
                </button>
              )}
            </div>

            {/* Logged User Info & Logout Button */}
            {user && (
              <div className="flex items-center space-x-2 bg-[#161d2a] border border-slate-800 p-1.5 px-3 rounded-2xl text-xs">
                <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
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
                className="flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Gerar CNAB ({selectedBoletosCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Modern Executive Gold Theme */}
        <div className="flex space-x-1 border-t border-slate-800 pt-2 overflow-x-auto no-scrollbar">
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

          {/* Inserir / Colar Boletos Tab */}
          <button
            onClick={() => setActiveTab('novo_boleto')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'novo_boleto'
                ? 'bg-emerald-950/60 text-emerald-400 border-b-2 border-emerald-500 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-[#131a27]'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Inserir / Colar Boletos</span>
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

          {/* Google Sheets Tab */}
          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-emerald-950/60 text-emerald-300 border-b-2 border-emerald-500 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-[#131a27]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Google Sheets</span>
          </button>
        </div>
      </div>
    </header>
  );
};
