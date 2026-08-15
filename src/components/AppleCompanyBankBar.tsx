import React, { useState, useRef, useEffect } from 'react';
import { CompanySettings, CompanyProfile, BankAccountProfile, AuthUser } from '../types';
import { getBankInfo } from '../utils/banks';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Settings2, 
  Plus, 
  ShieldCheck, 
  Landmark,
  CreditCard,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface AppleCompanyBankBarProps {
  company: CompanySettings;
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeBankId: string;
  onSelectCompany: (companyId: string) => void;
  onSelectBank: (bankId: string) => void;
  onManageCompanies: () => void;
}

export const AppleCompanyBankBar: React.FC<AppleCompanyBankBarProps> = ({
  company,
  companies,
  activeCompanyId,
  activeBankId,
  onSelectCompany,
  onSelectBank,
  onManageCompanies,
}) => {
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);

  const companyRef = useRef<HTMLDivElement>(null);
  const bankRef = useRef<HTMLDivElement>(null);

  const currentCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];
  const companyBanks = currentCompany ? currentCompany.bancos : [];
  const currentBank = companyBanks.find((b) => b.id === activeBankId) || companyBanks[0];
  const bankInfo = getBankInfo(currentBank?.bancoCodigo || company.bancoCodigo);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(event.target as Node)) {
        setIsCompanyOpen(false);
      }
      if (bankRef.current && !bankRef.current.contains(event.target as Node)) {
        setIsBankOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full bg-white/75 dark:bg-[#1c1c1e]/75 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.08] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* EMPRESA CARD - Apple Segmented Card Style */}
        <div className="relative" ref={companyRef}>
          <button
            type="button"
            onClick={() => {
              setIsCompanyOpen(!isCompanyOpen);
              setIsBankOpen(false);
            }}
            className={`group flex items-center gap-3 px-3.5 py-2 rounded-2xl transition-all text-left cursor-pointer border ${
              isCompanyOpen
                ? 'bg-blue-50/80 dark:bg-blue-500/15 border-blue-500/40 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border-black/[0.05] dark:border-white/[0.06]'
            }`}
          >
            {/* Apple rounded glyph */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-blue-500/20 shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>

            <div className="flex flex-col min-w-0 max-w-[180px] sm:max-w-[240px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Empresa Ativa
                </span>
                <span className="bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  {companies.length}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {currentCompany?.nomeFantasia || currentCompany?.razaoSocial || 'Selecionar Empresa'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                {currentCompany?.cnpjCpf}
              </span>
            </div>

            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isCompanyOpen ? 'rotate-180 text-blue-500' : ''}`} />
          </button>

          {/* Company Popover */}
          {isCompanyOpen && (
            <div className="absolute left-0 mt-2 w-84 sm:w-96 bg-white/95 dark:bg-[#252528]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" /> Selecionar Empresa
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCompanyOpen(false);
                    onManageCompanies();
                  }}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3 h-3" /> Gerenciar
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 p-1 no-scrollbar mt-1">
                {companies.map((c) => {
                  const isSelected = c.id === activeCompanyId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onSelectCompany(c.id);
                        setIsCompanyOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/40 text-blue-900 dark:text-white'
                          : 'bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border-transparent text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected 
                            ? 'bg-blue-500 text-white shadow-xs' 
                            : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300'
                        }`}>
                          {(c.nomeFantasia || c.razaoSocial).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                            {c.nomeFantasia || c.razaoSocial}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {c.cnpjCpf} • {c.bancos?.length || 0} conta(s)
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* BANCO CARD - Apple Segmented Card Style */}
        <div className="relative" ref={bankRef}>
          <button
            type="button"
            onClick={() => {
              setIsBankOpen(!isBankOpen);
              setIsCompanyOpen(false);
            }}
            className={`group flex items-center gap-3 px-3.5 py-2 rounded-2xl transition-all text-left cursor-pointer border ${
              isBankOpen
                ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-500/40 shadow-sm ring-2 ring-indigo-500/20'
                : 'bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border-black/[0.05] dark:border-white/[0.06]'
            }`}
          >
            {/* Apple Bank Glyph */}
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-xs shadow-sm border border-white/20"
              style={{ backgroundColor: bankInfo.color || '#EC0000' }}
            >
              {currentBank?.bancoCodigo || '033'}
            </div>

            <div className="flex flex-col min-w-0 max-w-[180px] sm:max-w-[240px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Conta Bancária
                </span>
                <span 
                  className="text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase"
                  style={{
                    backgroundColor: `${bankInfo.color}15`,
                    color: bankInfo.color === '#111827' ? '#64748b' : bankInfo.color,
                  }}
                >
                  {bankInfo.shortName}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {currentBank?.apelido || bankInfo.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Ag: <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentBank?.agencia}</strong></span>
                <span>•</span>
                <span>Cc: <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentBank?.conta}{currentBank?.contaDV ? `-${currentBank.contaDV}` : ''}</strong></span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">NSA #{currentBank?.bancoCodigo === '033' && (currentBank?.nsa || 1) < 11 ? 11 : currentBank?.nsa}</span>
              </div>
            </div>

            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isBankOpen ? 'rotate-180 text-indigo-500' : ''}`} />
          </button>

          {/* Bank Popover */}
          {isBankOpen && (
            <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-84 sm:w-96 bg-white/95 dark:bg-[#252528]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-indigo-500" /> Contas de {currentCompany?.nomeFantasia || 'Empresa'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsBankOpen(false);
                    onManageCompanies();
                  }}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3 h-3" /> Gerenciar
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 p-1 no-scrollbar mt-1">
                {companyBanks.map((b) => {
                  const isSelected = b.id === activeBankId;
                  const bInfo = getBankInfo(b.bancoCodigo);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        onSelectBank(b.id);
                        setIsBankOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/40 text-indigo-900 dark:text-white'
                          : 'bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border-transparent text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs border border-white/20"
                          style={{ backgroundColor: bInfo.color }}
                        >
                          {b.bancoCodigo}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                              {b.apelido || bInfo.name}
                            </p>
                            <span className="bg-black/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                              CNAB {b.padraoCNAB}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            Ag: <strong className="text-slate-700 dark:text-slate-300">{b.agencia}</strong> • Cc: <strong className="text-slate-700 dark:text-slate-300">{b.conta}{b.contaDV ? `-${b.contaDV}` : ''}</strong> • NSA #{b.bancoCodigo === '033' && (b.nsa || 1) < 11 ? 11 : b.nsa}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 ml-2">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Quick Action: Open Settings */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onManageCompanies}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.05] dark:border-white/[0.08] transition-all cursor-pointer"
        >
          <Settings2 className="w-3.5 h-3.5 text-blue-500" />
          <span>Configurar Contas</span>
        </button>
      </div>
    </div>
  );
};
