import React from 'react';
import { CompanySettings, CompanyProfile, AuthUser } from '../types';
import { getBankInfo } from '../utils/banks';
import { FileText, Building2, PlusCircle, History, CheckCircle2, ShieldCheck, Download, FileSpreadsheet, Sparkles, CreditCard, ChevronDown, Settings2, LogOut, User, Database } from 'lucide-react';

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
    <header className="bg-white text-slate-800 border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar: Brand, Company Status, Quick Actions & User Session */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-3.5 gap-4">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-tight flex items-center gap-1.5">
                  <span className="text-blue-700">Wanfinance</span>
                  <span className="text-slate-300 font-normal">|</span>
                  <span className="text-slate-800 text-lg font-bold">CNAB</span>
                </h1>
                <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                  CNAB {company.padraoCNAB}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Gestão Financeira & Remessas Bancárias
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Active Company & Bank Selection Control Bar */}
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs">
              {/* Empresa Dropdown */}
              <div className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Empresa Pagadora:
                  </span>
                  <select
                    value={activeCompanyId}
                    onChange={(e) => onSelectCompany(e.target.value)}
                    className="bg-transparent text-slate-800 font-semibold text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-white text-slate-800">
                        {c.nomeFantasia || c.razaoSocial} ({c.cnpjCpf})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Banco Dropdown */}
              <div className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: bankInfo.color }}
                ></div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Conta Bancária:
                  </span>
                  <select
                    value={activeBankId}
                    onChange={(e) => onSelectBank(e.target.value)}
                    className="bg-transparent text-slate-800 font-semibold text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    {companyBanks.map((b) => (
                      <option key={b.id} value={b.id} className="bg-white text-slate-800">
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
                className="bg-white hover:bg-slate-100 text-slate-700 hover:text-blue-700 p-2 rounded-xl border border-slate-200 transition-colors flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
              >
                <Settings2 className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline text-xs font-semibold">Gerenciar</span>
              </button>

              {/* Supabase Button */}
              {onOpenSupabaseModal && (
                <button
                  onClick={onOpenSupabaseModal}
                  title="Integração & Migrations Supabase"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 p-2 px-2.5 rounded-xl border border-emerald-200 transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline text-xs font-bold">Supabase</span>
                </button>
              )}
            </div>

            {/* Logged User Info & Logout Button */}
            {user && (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 p-1.5 px-3 rounded-2xl text-xs">
                <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-bold text-slate-800 leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold leading-tight">
                    {user.role}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Encerrar Sessão / Sair"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all ml-1 cursor-pointer"
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
                className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Gerar CNAB ({selectedBoletosCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 border-t border-slate-200 pt-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('boletos')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'boletos'
                ? 'bg-blue-50/80 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-600 hover:text-blue-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Boletos a Pagar</span>
            {selectedBoletosCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {selectedBoletosCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('novo_boleto')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'novo_boleto'
                ? 'bg-blue-50/80 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-600 hover:text-blue-700 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Inserir / Colar Boletos</span>
          </button>

          <button
            onClick={onOpenPDFModal}
            className="flex items-center space-x-2 px-4 py-2.5 text-sm font-bold text-blue-700 hover:text-blue-800 bg-blue-100/70 hover:bg-blue-100 border border-blue-200 rounded-t-lg transition-all whitespace-nowrap shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>Extrair PDF (IA)</span>
          </button>

          <button
            onClick={() => setActiveTab('empresa')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'empresa'
                ? 'bg-blue-50/80 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-600 hover:text-blue-700 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Dados da Empresa & Banco</span>
          </button>

          <button
            onClick={() => setActiveTab('historico')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'historico'
                ? 'bg-blue-50/80 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-600 hover:text-blue-700 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>Remessas Geradas</span>
          </button>

          <button
            onClick={() => setActiveTab('validador')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'validador'
                ? 'bg-blue-50/80 text-blue-700 border-b-2 border-blue-600 font-bold'
                : 'text-slate-600 hover:text-blue-700 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Validador CNAB</span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-emerald-50 text-emerald-800 border-b-2 border-emerald-600'
                : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Google Sheets</span>
          </button>
        </div>
      </div>
    </header>
  );
};
