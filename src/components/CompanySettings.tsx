import React, { useState } from 'react';
import { CompanyProfile, BankAccountProfile } from '../types';
import { BRAZILIAN_BANKS, getBankInfo } from '../utils/banks';
import { Building2, CreditCard, Plus, Trash2, Edit3, CheckCircle2, Shield, RefreshCw, Save, Check, FileText, Info, Sparkles, Building, ChevronRight, Star } from 'lucide-react';

interface CompanySettingsProps {
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeBankId: string;
  onSaveCompanyProfiles: (companies: CompanyProfile[], newActiveCompanyId?: string, newActiveBankId?: string) => void;
  onSelectCompany: (companyId: string) => void;
  onSelectBank: (bankId: string) => void;
}

export const CompanySettingsComponent: React.FC<CompanySettingsProps> = ({
  companies,
  activeCompanyId,
  activeBankId,
  onSaveCompanyProfiles,
  onSelectCompany,
  onSelectBank,
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(activeCompanyId);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Modals / Editors state
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [editingBankModal, setEditingBankModal] = useState<{ isOpen: boolean; bank: BankAccountProfile | null; isNew: boolean }>({
    isOpen: false,
    bank: null,
    isNew: false,
  });

  // Current company profile
  const currentCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  // Forms state for company edit/create
  const [companyForm, setCompanyForm] = useState<CompanyProfile>(currentCompany);

  // Sync state if selected company changes
  const handleSelectCompanyTab = (id: string) => {
    setSelectedCompanyId(id);
    const targetComp = companies.find((c) => c.id === id);
    if (targetComp) {
      setCompanyForm(targetComp);
      onSelectCompany(id);
    }
  };

  // Save current company details
  const handleSaveCompanyDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedCompanies = companies.map((c) => (c.id === companyForm.id ? companyForm : c));
    onSaveCompanyProfiles(updatedCompanies);
    setIsEditingCompany(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Add new company
  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const newCompanyId = `comp-${Date.now()}`;
    const newBankId = `bank-${Date.now()}`;

    const defaultBank: BankAccountProfile = {
      id: newBankId,
      apelido: 'Itaú - Conta Principal',
      bancoCodigo: '341',
      bancoNome: 'Itaú Unibanco S.A.',
      agencia: '1000',
      agenciaDV: '0',
      conta: '12345',
      contaDV: '6',
      convenio: '12345678',
      codigoTransmissao: '',
      nsa: 1,
      padraoCNAB: '240',
      layoutVersaoLote: '046',
    };

    const newCompany: CompanyProfile = {
      ...companyForm,
      id: newCompanyId,
      bancos: [defaultBank],
      activeBankId: newBankId,
    };

    const updatedCompanies = [...companies, newCompany];
    onSaveCompanyProfiles(updatedCompanies, newCompanyId, newBankId);
    setSelectedCompanyId(newCompanyId);
    setIsAddingCompany(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Delete company
  const handleDeleteCompany = (compToDeleteId: string) => {
    if (companies.length <= 1) {
      alert('Você deve manter pelo menos uma empresa cadastrada no sistema.');
      return;
    }
    if (confirm('Tem certeza que deseja excluir esta empresa pagadora? Todos os bancos associados também serão removidos.')) {
      const remaining = companies.filter((c) => c.id !== compToDeleteId);
      const nextActiveComp = remaining[0];
      const nextActiveBank = nextActiveComp.bancos[0]?.id || '';
      onSaveCompanyProfiles(remaining, nextActiveComp.id, nextActiveBank);
      setSelectedCompanyId(nextActiveComp.id);
    }
  };

  // Bank Account Modal submit
  const handleSaveBankModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankModal.bank) return;

    const bankToSave = editingBankModal.bank;
    const bankInfo = getBankInfo(bankToSave.bancoCodigo);
    bankToSave.bancoNome = bankInfo.name;

    let updatedBanks = [...currentCompany.bancos];
    if (editingBankModal.isNew) {
      updatedBanks.push(bankToSave);
    } else {
      updatedBanks = updatedBanks.map((b) => (b.id === bankToSave.id ? bankToSave : b));
    }

    const updatedCompany: CompanyProfile = {
      ...currentCompany,
      bancos: updatedBanks,
      activeBankId: currentCompany.activeBankId || bankToSave.id,
    };

    const updatedCompanies = companies.map((c) => (c.id === updatedCompany.id ? updatedCompany : c));
    onSaveCompanyProfiles(updatedCompanies, updatedCompany.id, bankToSave.id);
    setEditingBankModal({ isOpen: false, bank: null, isNew: false });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Delete bank account
  const handleDeleteBank = (bankIdToDelete: string) => {
    if (currentCompany.bancos.length <= 1) {
      alert('A empresa deve ter pelo menos uma conta bancária cadastrada.');
      return;
    }
    if (confirm('Deseja excluir esta conta bancária?')) {
      const updatedBanks = currentCompany.bancos.filter((b) => b.id !== bankIdToDelete);
      const nextActiveBankId = updatedBanks[0].id;
      const updatedCompany = {
        ...currentCompany,
        bancos: updatedBanks,
        activeBankId: nextActiveBankId,
      };
      const updatedCompanies = companies.map((c) => (c.id === updatedCompany.id ? updatedCompany : c));
      onSaveCompanyProfiles(updatedCompanies, updatedCompany.id, nextActiveBankId);
    }
  };

  // Set default active bank for current company
  const handleSetActiveBank = (bankId: string) => {
    const updatedCompany = { ...currentCompany, activeBankId: bankId };
    const updatedCompanies = companies.map((c) => (c.id === updatedCompany.id ? updatedCompany : c));
    onSaveCompanyProfiles(updatedCompanies, updatedCompany.id, bankId);
    onSelectBank(bankId);
  };

  const isCurrentActiveGlobal = currentCompany.id === activeCompanyId;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-2xl border border-amber-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Empresas Pagadoras & Contas Bancárias</h2>
            <p className="text-xs text-slate-400">
              Cadastre e gerencie múltiplas empresas e bancos para geração de arquivos de remessa CNAB 240 / 400.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-3 py-2 rounded-xl flex items-center space-x-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Dados Salvos com Sucesso!</span>
          </div>
        )}
      </div>

      {/* Companies Bar / Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Selecione a Empresa Pagadora ({companies.length})
            </h3>
          </div>

          <button
            onClick={() => {
              setCompanyForm({
                id: '',
                nomeFantasia: '',
                razaoSocial: '',
                cnpjCpf: '',
                tipoInscricao: 'CNPJ',
                logradouro: '',
                numero: '',
                complemento: '',
                cidade: '',
                uf: 'SP',
                cep: '',
                bancos: [],
              });
              setIsAddingCompany(true);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center space-x-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Empresa Pagadora</span>
          </button>
        </div>

        {/* Company Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {companies.map((comp) => {
            const isSelected = comp.id === selectedCompanyId;
            const isGlobalActive = comp.id === activeCompanyId;

            return (
              <button
                key={comp.id}
                onClick={() => handleSelectCompanyTab(comp.id)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border text-xs text-left transition-all shrink-0 ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-bold text-slate-100 truncate max-w-[180px]">
                      {comp.nomeFantasia || comp.razaoSocial}
                    </p>
                    {isGlobalActive && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        Ativa no Header
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    CNPJ: {comp.cnpjCpf} | {comp.bancos.length} conta(s)
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Company Profile Details */}
      {currentCompany && (
        <div className="space-y-6">
          {/* Section 1: Company Profile Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-white">
                    {currentCompany.razaoSocial}
                  </h3>
                  {isCurrentActiveGlobal ? (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Empresa Ativa para Pagamentos
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectCompany(currentCompany.id)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-xl border border-slate-700 font-medium transition-colors"
                    >
                      Definir como Empresa Ativa
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  CNPJ: <span className="font-mono text-slate-200">{currentCompany.cnpjCpf}</span> | Cidade: {currentCompany.cidade}/{currentCompany.uf}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setCompanyForm(currentCompany);
                    setIsEditingCompany(!isEditingCompany);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl border border-slate-700 transition-colors flex items-center space-x-1.5"
                >
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  <span>{isEditingCompany ? 'Cancelar Edição' : 'Editar Empresa'}</span>
                </button>

                {companies.length > 1 && (
                  <button
                    onClick={() => handleDeleteCompany(currentCompany.id)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs px-3 py-2 rounded-xl border border-red-500/30 transition-colors flex items-center space-x-1"
                    title="Excluir Empresa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Company Edit Form */}
            {isEditingCompany ? (
              <form onSubmit={handleSaveCompanyDetails} className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Editar Dados Cadastrais da Empresa
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      value={companyForm.razaoSocial}
                      onChange={(e) => setCompanyForm({ ...companyForm, razaoSocial: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Nome Fantasia (Apelido)
                    </label>
                    <input
                      type="text"
                      value={companyForm.nomeFantasia || ''}
                      onChange={(e) => setCompanyForm({ ...companyForm, nomeFantasia: e.target.value })}
                      placeholder="Ex: Matriz SP"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Tipo de Inscrição
                    </label>
                    <select
                      value={companyForm.tipoInscricao}
                      onChange={(e) => setCompanyForm({ ...companyForm, tipoInscricao: e.target.value as 'CNPJ' | 'CPF' })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Número de CNPJ / CPF
                    </label>
                    <input
                      type="text"
                      value={companyForm.cnpjCpf}
                      onChange={(e) => setCompanyForm({ ...companyForm, cnpjCpf: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Logradouro
                    </label>
                    <input
                      type="text"
                      value={companyForm.logradouro}
                      onChange={(e) => setCompanyForm({ ...companyForm, logradouro: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Número / Compl
                    </label>
                    <input
                      type="text"
                      value={companyForm.numero}
                      onChange={(e) => setCompanyForm({ ...companyForm, numero: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Cidade / UF
                    </label>
                    <div className="flex space-x-1">
                      <input
                        type="text"
                        value={companyForm.cidade}
                        onChange={(e) => setCompanyForm({ ...companyForm, cidade: e.target.value })}
                        className="w-2/3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-2 py-2 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        maxLength={2}
                        value={companyForm.uf}
                        onChange={(e) => setCompanyForm({ ...companyForm, uf: e.target.value.toUpperCase() })}
                        className="w-1/3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-2 py-2 font-bold text-center focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingCompany(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center space-x-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Empresa</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Logradouro:</span>
                  <span className="text-slate-200 font-semibold">{currentCompany.logradouro || '-'}, {currentCompany.numero}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Cidade / UF:</span>
                  <span className="text-slate-200 font-semibold">{currentCompany.cidade} - {currentCompany.uf}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Inscrição:</span>
                  <span className="text-slate-200 font-mono font-semibold">{currentCompany.tipoInscricao}: {currentCompany.cnpjCpf}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Contas Bancárias:</span>
                  <span className="text-blue-400 font-bold">{currentCompany.bancos.length} configurada(s)</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Bank Accounts Management for Selected Company */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Contas Bancárias Cadastradas ({currentCompany.bancos.length})
                </h3>
              </div>

              <button
                onClick={() => {
                  setEditingBankModal({
                    isOpen: true,
                    isNew: true,
                    bank: {
                      id: `bank-${Date.now()}`,
                      apelido: 'Bradesco - Conta Folha',
                      bancoCodigo: '237',
                      bancoNome: 'Banco Bradesco S.A.',
                      agencia: '1234',
                      agenciaDV: '0',
                      conta: '56789',
                      contaDV: '0',
                      convenio: '123456',
                      codigoTransmissao: '',
                      nsa: 1,
                      padraoCNAB: '240',
                      layoutVersaoLote: '040',
                    },
                  });
                }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Conta Bancária</span>
              </button>
            </div>

            {/* List of Bank Accounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentCompany.bancos.map((b) => {
                const bInfo = getBankInfo(b.bancoCodigo);
                const isSelectedBankActive = currentCompany.activeBankId === b.id;
                const isGloballySelected = isCurrentActiveGlobal && activeBankId === b.id;

                return (
                  <div
                    key={b.id}
                    className={`bg-slate-950 border rounded-2xl p-5 space-y-4 transition-all relative overflow-hidden ${
                      isGloballySelected
                        ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                        : isSelectedBankActive
                        ? 'border-blue-500/80'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top Bank Info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0"
                          style={{ backgroundColor: bInfo.color }}
                        >
                          {b.bancoCodigo}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-white">{b.apelido}</h4>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">{bInfo.name}</p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isGloballySelected ? (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" /> Conta Ativa no Header
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetActiveBank(b.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium px-2.5 py-1 rounded-xl border border-slate-700 transition-colors shrink-0"
                        >
                          Selecionar Conta
                        </button>
                      )}
                    </div>

                    {/* Bank Details Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-3 rounded-xl text-xs font-mono border border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans font-semibold uppercase">Agência / DV</span>
                        <span className="text-slate-200 font-bold">{b.agencia}-{b.agenciaDV}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans font-semibold uppercase">Conta Corrente / DV</span>
                        <span className="text-slate-200 font-bold">{b.conta}-{b.contaDV}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans font-semibold uppercase">Convênio</span>
                        <span className="text-amber-400 font-bold">{b.convenio}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans font-semibold uppercase">CNAB & NSA</span>
                        <span className="text-blue-400 font-bold">CNAB {b.padraoCNAB} | #{b.nsa}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
                      <span className="text-[11px] text-slate-500">
                        Layout Lote: <strong className="text-slate-300 font-mono">{b.layoutVersaoLote || '046'}</strong>
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingBankModal({
                              isOpen: true,
                              isNew: false,
                              bank: { ...b },
                            });
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold px-2.5 py-1 rounded-lg border border-slate-700 transition-colors flex items-center space-x-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        {currentCompany.bancos.length > 1 && (
                          <button
                            onClick={() => handleDeleteBank(b.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold px-2 py-1 rounded-lg border border-red-500/20 transition-colors"
                            title="Excluir Conta Bancária"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Company */}
      {isAddingCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Cadastrar Nova Empresa Pagadora</h3>
              </div>
              <button
                onClick={() => setIsAddingCompany(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Razão Social da Empresa
                </label>
                <input
                  type="text"
                  value={companyForm.razaoSocial}
                  onChange={(e) => setCompanyForm({ ...companyForm, razaoSocial: e.target.value })}
                  placeholder="Ex: NOVA EMPRESA FILIAL S/A"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Tipo
                  </label>
                  <select
                    value={companyForm.tipoInscricao}
                    onChange={(e) => setCompanyForm({ ...companyForm, tipoInscricao: e.target.value as 'CNPJ' | 'CPF' })}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-2 py-2.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CNPJ">CNPJ</option>
                    <option value="CPF">CPF</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Número do CNPJ / CPF
                  </label>
                  <input
                    type="text"
                    value={companyForm.cnpjCpf}
                    onChange={(e) => setCompanyForm({ ...companyForm, cnpjCpf: e.target.value })}
                    placeholder="12.345.678/0002-00"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nome Fantasia / Apelido
                  </label>
                  <input
                    type="text"
                    value={companyForm.nomeFantasia || ''}
                    onChange={(e) => setCompanyForm({ ...companyForm, nomeFantasia: e.target.value })}
                    placeholder="Ex: Unidade Filial RJ"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Cidade / UF
                  </label>
                  <div className="flex space-x-1">
                    <input
                      type="text"
                      value={companyForm.cidade}
                      onChange={(e) => setCompanyForm({ ...companyForm, cidade: e.target.value })}
                      placeholder="Rio de Janeiro"
                      className="w-2/3 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-2 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      maxLength={2}
                      value={companyForm.uf}
                      onChange={(e) => setCompanyForm({ ...companyForm, uf: e.target.value.toUpperCase() })}
                      placeholder="RJ"
                      className="w-1/3 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-bold text-center rounded-xl px-2 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingCompany(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Empresa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit / Add Bank Account */}
      {editingBankModal.isOpen && editingBankModal.bank && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {editingBankModal.isNew ? 'Adicionar Nova Conta Bancária' : 'Editar Conta Bancária'}
                </h3>
              </div>
              <button
                onClick={() => setEditingBankModal({ isOpen: false, bank: null, isNew: false })}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBankModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Apelido da Conta Bancária
                </label>
                <input
                  type="text"
                  value={editingBankModal.bank.apelido}
                  onChange={(e) =>
                    setEditingBankModal({
                      ...editingBankModal,
                      bank: { ...editingBankModal.bank!, apelido: e.target.value },
                    })
                  }
                  placeholder="Ex: Itaú - Operacional, Bradesco - Folha"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Banco
                  </label>
                  <select
                    value={editingBankModal.bank.bancoCodigo}
                    onChange={(e) => {
                      const code = e.target.value;
                      const bInfo = getBankInfo(code);
                      setEditingBankModal({
                        ...editingBankModal,
                        bank: { ...editingBankModal.bank!, bancoCodigo: code, bancoNome: bInfo.name },
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  >
                    {Object.values(BRAZILIAN_BANKS).map((b) => (
                      <option key={b.code} value={b.code}>
                        [{b.code}] {b.shortName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Agência / DV
                  </label>
                  <div className="flex space-x-1">
                    <input
                      type="text"
                      value={editingBankModal.bank.agencia}
                      onChange={(e) =>
                        setEditingBankModal({
                          ...editingBankModal,
                          bank: { ...editingBankModal.bank!, agencia: e.target.value },
                        })
                      }
                      placeholder="1234"
                      className="w-3/4 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <input
                      type="text"
                      maxLength={2}
                      value={editingBankModal.bank.agenciaDV}
                      onChange={(e) =>
                        setEditingBankModal({
                          ...editingBankModal,
                          bank: { ...editingBankModal.bank!, agenciaDV: e.target.value },
                        })
                      }
                      placeholder="X"
                      className="w-1/4 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono text-center rounded-xl px-1 py-2.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Conta / DV
                  </label>
                  <div className="flex space-x-1">
                    <input
                      type="text"
                      value={editingBankModal.bank.conta}
                      onChange={(e) =>
                        setEditingBankModal({
                          ...editingBankModal,
                          bank: { ...editingBankModal.bank!, conta: e.target.value },
                        })
                      }
                      placeholder="123456"
                      className="w-3/4 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <input
                      type="text"
                      maxLength={2}
                      value={editingBankModal.bank.contaDV}
                      onChange={(e) =>
                        setEditingBankModal({
                          ...editingBankModal,
                          bank: { ...editingBankModal.bank!, contaDV: e.target.value },
                        })
                      }
                      placeholder="7"
                      className="w-1/4 bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono text-center rounded-xl px-1 py-2.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Código de Convênio no Banco
                  </label>
                  <input
                    type="text"
                    value={editingBankModal.bank.convenio}
                    onChange={(e) =>
                      setEditingBankModal({
                        ...editingBankModal,
                        bank: { ...editingBankModal.bank!, convenio: e.target.value },
                      })
                    }
                    placeholder="Ex: 98765432"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Código Transmissão (Opcional)
                  </label>
                  <input
                    type="text"
                    value={editingBankModal.bank.codigoTransmissao || ''}
                    onChange={(e) =>
                      setEditingBankModal({
                        ...editingBankModal,
                        bank: { ...editingBankModal.bank!, codigoTransmissao: e.target.value },
                      })
                    }
                    placeholder="Ex: 1234567890"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Padrão CNAB
                  </label>
                  <select
                    value={editingBankModal.bank.padraoCNAB}
                    onChange={(e) =>
                      setEditingBankModal({
                        ...editingBankModal,
                        bank: { ...editingBankModal.bank!, padraoCNAB: e.target.value as '240' | '400' },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="240">CNAB 240</option>
                    <option value="400">CNAB 400</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Versão Layout Lote
                  </label>
                  <input
                    type="text"
                    value={editingBankModal.bank.layoutVersaoLote || '046'}
                    onChange={(e) =>
                      setEditingBankModal({
                        ...editingBankModal,
                        bank: { ...editingBankModal.bank!, layoutVersaoLote: e.target.value },
                      })
                    }
                    placeholder="046"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Próximo NSA
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingBankModal.bank.nsa}
                    onChange={(e) =>
                      setEditingBankModal({
                        ...editingBankModal,
                        bank: { ...editingBankModal.bank!, nsa: Number(e.target.value) },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBankModal({ isOpen: false, bank: null, isNew: false })}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Conta Bancária</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

