import React, { useState } from 'react';
import {
  Brain,
  Upload,
  CheckCircle2,
  FileCode,
  Layers,
  Sparkles,
  Edit3,
  Plus,
  Trash2,
  Save,
  Search,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Building2,
  HelpCircle,
  Code2,
  Terminal,
} from 'lucide-react';
import {
  LearnedCNABExtratoLayout,
  CNABExtratoFieldSpec,
  MovementCodeDefinition,
  CompanySettings,
} from '../../types';
import {
  reverseEngineCnabStructure,
  loadLearnedExtratoLayouts,
  saveLearnedExtratoLayouts,
  MOVEMENT_CODES_DATABASE,
} from '../../utils/cnabExtratoEngine';

interface ModelCnabAnalyzerViewProps {
  company?: CompanySettings;
  onShowToast?: (msg: string) => void;
}

export const ModelCnabAnalyzerView: React.FC<ModelCnabAnalyzerViewProps> = ({
  company,
  onShowToast,
}) => {
  const [modelFileName, setModelFileName] = useState('');
  const [analyzedLayout, setAnalyzedLayout] = useState<LearnedCNABExtratoLayout | null>(null);
  const [selectedSegmentTab, setSelectedSegmentTab] = useState<'HEADER' | 'SEGMENTO_E' | 'RAW_LINES' | 'CODES'>('SEGMENTO_E');
  const [selectedFieldPos, setSelectedFieldPos] = useState<CNABExtratoFieldSpec | null>(null);

  // Form para edição dos vínculos do layout (Empresa, CNPJ, Banco, Agência, Conta, Convênio, Versão)
  const [layoutForm, setLayoutForm] = useState({
    nomeLayout: '',
    bancoCodigo: '341',
    bancoNome: 'Banco Itaú',
    empresaNome: company?.razaoSocial || '',
    cnpjEmpresa: company?.cnpj || '',
    agenciaPadrao: company?.agencia || '',
    digitoAgencia: '',
    contaPadrao: company?.conta || '',
    digitoConta: '',
    convenioPadrao: company?.convenio || '',
    codigoEmpresaBanco: company?.convenio || '',
    seqArquivoModelo: '000001',
    versaoLayoutModelo: '087',
  });

  // Mapeamento de Códigos de Movimentação editáveis
  const [movementCodes, setMovementCodes] = useState<MovementCodeDefinition[]>(MOVEMENT_CODES_DATABASE.DEFAULT_CODES);
  const [newCode, setNewCode] = useState({ codigo: '', descricao: '', grupo: 'CREDITO' as const });

  // Lista de layouts salvos
  const [savedLayouts, setSavedLayouts] = useState<LearnedCNABExtratoLayout[]>(() => loadLearnedExtratoLayouts());

  const showToast = (msg: string) => {
    if (onShowToast) onShowToast(msg);
    else alert(msg);
  };

  // 1. Process CNAB Model File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setModelFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      if (!content.trim()) {
        alert('O arquivo selecionado está vazio.');
        return;
      }

      // Reverse engineering layout
      const learned = reverseEngineCnabStructure(content, file.name, company);
      setAnalyzedLayout(learned);
      setLayoutForm({
        nomeLayout: learned.nomeLayout,
        bancoCodigo: learned.bancoCodigo,
        bancoNome: learned.bancoNome,
        empresaNome: learned.empresaNome || company?.razaoSocial || '',
        cnpjEmpresa: learned.cnpjEmpresa || company?.cnpj || '',
        agenciaPadrao: learned.agenciaPadrao || company?.agencia || '',
        digitoAgencia: learned.digitoAgencia || '',
        contaPadrao: learned.contaPadrao || company?.conta || '',
        digitoConta: learned.digitoConta || '',
        convenioPadrao: learned.convenioPadrao || company?.convenio || '',
        codigoEmpresaBanco: learned.codigoEmpresaBanco || company?.convenio || '',
        seqArquivoModelo: learned.seqArquivoModelo || '000001',
        versaoLayoutModelo: learned.versaoLayoutModelo || '087',
      });
      setSavedLayouts(loadLearnedExtratoLayouts());
      showToast(`Layout do arquivo ${file.name} analisado e copiado exatamente com sucesso!`);
    };

    reader.readAsText(file, 'ISO-8859-1'); // Suporte a caracteres acentuados de bancos
  };

  // Salva ou atualiza as alterações do layout
  const handleSaveLayoutChanges = () => {
    if (!analyzedLayout) return;

    const updatedLayout: LearnedCNABExtratoLayout = {
      ...analyzedLayout,
      nomeLayout: layoutForm.nomeLayout || analyzedLayout.nomeLayout,
      bancoCodigo: layoutForm.bancoCodigo,
      bancoNome: layoutForm.bancoNome,
      empresaId: company?.id || analyzedLayout.empresaId,
      empresaNome: layoutForm.empresaNome,
      cnpjEmpresa: layoutForm.cnpjEmpresa,
      agenciaPadrao: layoutForm.agenciaPadrao,
      digitoAgencia: layoutForm.digitoAgencia,
      contaPadrao: layoutForm.contaPadrao,
      digitoConta: layoutForm.digitoConta,
      convenioPadrao: layoutForm.convenioPadrao,
      codigoEmpresaBanco: layoutForm.codigoEmpresaBanco,
      seqArquivoModelo: layoutForm.seqArquivoModelo,
      versaoLayoutModelo: layoutForm.versaoLayoutModelo,
    };

    const currentLayouts = loadLearnedExtratoLayouts();
    const idx = currentLayouts.findIndex((l) => l.id === updatedLayout.id);
    if (idx >= 0) {
      currentLayouts[idx] = updatedLayout;
    } else {
      currentLayouts.unshift(updatedLayout);
    }

    saveLearnedExtratoLayouts(currentLayouts);
    setSavedLayouts(currentLayouts);
    setAnalyzedLayout(updatedLayout);
    showToast('Modelo de CNAB salvo com sucesso na base de layouts por Empresa e Banco!');
  };

  // Seleciona modelo salvo para visualizar/editar
  const handleSelectSavedLayout = (layout: LearnedCNABExtratoLayout) => {
    setAnalyzedLayout(layout);
    setLayoutForm({
      nomeLayout: layout.nomeLayout,
      bancoCodigo: layout.bancoCodigo,
      bancoNome: layout.bancoNome,
      empresaNome: layout.empresaNome || company?.razaoSocial || '',
      cnpjEmpresa: layout.cnpjEmpresa || company?.cnpj || '',
      agenciaPadrao: layout.agenciaPadrao || company?.agencia || '',
      digitoAgencia: layout.digitoAgencia || '',
      contaPadrao: layout.contaPadrao || company?.conta || '',
      digitoConta: layout.digitoConta || '',
      convenioPadrao: layout.convenioPadrao || company?.convenio || '',
      codigoEmpresaBanco: layout.codigoEmpresaBanco || company?.convenio || '',
      seqArquivoModelo: layout.seqArquivoModelo || '000001',
      versaoLayoutModelo: layout.versaoLayoutModelo || '087',
    });
    showToast(`Modelo "${layout.nomeLayout}" carregado para inspeção/edição.`);
  };

  // State para modal de confirmação de exclusão
  const [deleteModalTarget, setDeleteModalTarget] = useState<{ id: string; name: string } | null>(null);

  // Solicita exclusão de um modelo de layout salvo
  const promptDeleteLayout = (layoutId: string, layoutName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteModalTarget({ id: layoutId, name: layoutName });
  };

  // Executa a exclusão confirmada
  const confirmDeleteLayout = () => {
    if (!deleteModalTarget) return;
    const { id, name } = deleteModalTarget;

    const updated = savedLayouts.filter((l) => l.id !== id);
    saveLearnedExtratoLayouts(updated);
    setSavedLayouts(updated);

    if (analyzedLayout?.id === id) {
      setAnalyzedLayout(null);
    }

    setDeleteModalTarget(null);
    showToast(`Modelo "${name}" excluído com sucesso!`);
  };

  // Add custom code mapping
  const handleAddCode = () => {
    if (!newCode.codigo.trim() || !newCode.descricao.trim()) {
      alert('Preencha o código e a descrição.');
      return;
    }
    const updated = [
      ...movementCodes,
      { codigo: newCode.codigo.trim(), descricao: newCode.descricao.trim(), grupo: newCode.grupo },
    ];
    setMovementCodes(updated);
    setNewCode({ codigo: '', descricao: '', grupo: 'CREDITO' });
    showToast('Novo código de movimentação adicionado com sucesso!');
  };

  // Remove custom code
  const handleRemoveCode = (code: string) => {
    setMovementCodes(movementCodes.filter((c) => c.codigo !== code));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner Opção 2 */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-purple-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-purple-500/20">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <span>Opção 2: Modelo CNAB → Aprendizado Exato por Empresa & Banco</span>
                  <span className="bg-purple-400/20 text-purple-300 text-xs px-2.5 py-0.5 rounded-full border border-purple-400/30 normal-case font-bold">
                    Engenharia Reversa
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-purple-200 font-medium">
                  Envie um arquivo CNAB modelo para a IA copiar exatamente todos os campos, posições e dados da empresa/banco para reuso rápido.
                </p>
              </div>
            </div>
          </div>

          <label className="bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-black px-5 py-3 rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto">
            <Upload className="w-4 h-4" />
            <span>Enviar Arquivo CNAB Modelo</span>
            <input type="file" accept=".ret, .rem, .txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* TELA DE ANÁLISE DO LAYOUT APRENDIDO */}
      {analyzedLayout ? (
        <div className="space-y-6">
          {/* Card Resumo do Layout & Vínculo da Empresa/Banco */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                    Layout CNAB Copiado Exatamente
                  </span>
                  <h3 className="text-lg font-black text-slate-900">{analyzedLayout.nomeLayout}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Banco: <strong>{analyzedLayout.bancoNome} ({analyzedLayout.bancoCodigo})</strong> • Padrão: <strong>CNAB {analyzedLayout.padraoCNAB}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveLayoutChanges}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Vínculo Empresa & Banco</span>
                </button>

                <button
                  onClick={() => promptDeleteLayout(analyzedLayout.id, analyzedLayout.nomeLayout)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black px-4 py-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
                  title="Excluir este modelo"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Modelo</span>
                </button>
              </div>
            </div>

            {/* Ajuste de Vínculos: Empresa, CNPJ, Banco, Agência, Conta, Convênio, Versão */}
            <div className="space-y-4 bg-slate-50 border border-slate-200 p-5 rounded-2xl">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>Dados do Modelo CNAB Extraídos (Empresa, Banco, Conta & Convênio)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Razão Social da Empresa:
                  </label>
                  <input
                    type="text"
                    value={layoutForm.empresaNome}
                    onChange={(e) => setLayoutForm({ ...layoutForm, empresaNome: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-bold"
                    placeholder="Razão Social"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    CNPJ / CPF da Empresa:
                  </label>
                  <input
                    type="text"
                    value={layoutForm.cnpjEmpresa}
                    onChange={(e) => setLayoutForm({ ...layoutForm, cnpjEmpresa: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                    placeholder="CNPJ (14 dígitos)"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Código do Banco:
                  </label>
                  <input
                    type="text"
                    value={layoutForm.bancoCodigo}
                    onChange={(e) => setLayoutForm({ ...layoutForm, bancoCodigo: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                    placeholder="Ex: 001, 033, 237, 341"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Agência e DV:
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={layoutForm.agenciaPadrao}
                      onChange={(e) => setLayoutForm({ ...layoutForm, agenciaPadrao: e.target.value })}
                      className="w-3/4 bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                      placeholder="Agência"
                    />
                    <input
                      type="text"
                      value={layoutForm.digitoAgencia}
                      onChange={(e) => setLayoutForm({ ...layoutForm, digitoAgencia: e.target.value })}
                      className="w-1/4 bg-white border border-slate-200 text-slate-900 text-xs px-2 py-2 rounded-xl font-mono font-bold text-center"
                      placeholder="DV"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Conta Corrente e DV:
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={layoutForm.contaPadrao}
                      onChange={(e) => setLayoutForm({ ...layoutForm, contaPadrao: e.target.value })}
                      className="w-3/4 bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                      placeholder="Conta"
                    />
                    <input
                      type="text"
                      value={layoutForm.digitoConta}
                      onChange={(e) => setLayoutForm({ ...layoutForm, digitoConta: e.target.value })}
                      className="w-1/4 bg-white border border-slate-200 text-slate-900 text-xs px-2 py-2 rounded-xl font-mono font-bold text-center"
                      placeholder="DV"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Código do Convênio / Transmissão:
                  </label>
                  <input
                    type="text"
                    value={layoutForm.codigoEmpresaBanco}
                    onChange={(e) => setLayoutForm({ ...layoutForm, codigoEmpresaBanco: e.target.value, convenioPadrao: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                    placeholder="Convênio Banco"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Nº Sequencial do Arquivo (NSA):
                  </label>
                  <input
                    type="text"
                    value={layoutForm.seqArquivoModelo}
                    onChange={(e) => setLayoutForm({ ...layoutForm, seqArquivoModelo: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                    placeholder="000001"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Versão do Layout CNAB:
                  </label>
                  <input
                    type="text"
                    value={layoutForm.versaoLayoutModelo}
                    onChange={(e) => setLayoutForm({ ...layoutForm, versaoLayoutModelo: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-mono font-bold"
                    placeholder="087"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Abas de Navegação da Análise */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex border-b border-slate-100 pb-2 space-x-4 overflow-x-auto">
              <button
                onClick={() => setSelectedSegmentTab('SEGMENTO_E')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  selectedSegmentTab === 'SEGMENTO_E'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Análise de Campos (Segmento E - Detalhe)
              </button>
              <button
                onClick={() => setSelectedSegmentTab('RAW_LINES')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  selectedSegmentTab === 'RAW_LINES'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Linhas Modelo Espelhadas (240 Colunas)
              </button>
              <button
                onClick={() => setSelectedSegmentTab('HEADER')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  selectedSegmentTab === 'HEADER'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Header de Arquivo
              </button>
              <button
                onClick={() => setSelectedSegmentTab('CODES')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  selectedSegmentTab === 'CODES'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Tabela de Códigos de Movimentação
              </button>
            </div>

            {/* TAB: RAW LINES MODELO ESPELHADO */}
            {selectedSegmentTab === 'RAW_LINES' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-purple-600" />
                    <span>Amostras das Linhas Originais Modelo Copiadas Posição por Posição</span>
                  </h4>
                  <span className="text-[11px] text-purple-700 bg-purple-50 font-bold px-2.5 py-1 rounded-lg">
                    Tamanho Exato: 240 Posições
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {analyzedLayout.sampleHeaderArq && (
                    <div className="bg-slate-950 text-emerald-400 p-4 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">
                        Header de Arquivo Modelo:
                      </span>
                      <p className="whitespace-pre overflow-x-auto select-all">{analyzedLayout.sampleHeaderArq}</p>
                    </div>
                  )}

                  {analyzedLayout.sampleHeaderLote && (
                    <div className="bg-slate-950 text-emerald-400 p-4 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">
                        Header de Lote Modelo:
                      </span>
                      <p className="whitespace-pre overflow-x-auto select-all">{analyzedLayout.sampleHeaderLote}</p>
                    </div>
                  )}

                  {analyzedLayout.sampleSegmentE && (
                    <div className="bg-slate-950 text-cyan-400 p-4 rounded-2xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">
                        Segmento E (Detalhe do Extrato) Modelo:
                      </span>
                      <p className="whitespace-pre overflow-x-auto select-all">{analyzedLayout.sampleSegmentE}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONTEÚDO TAB: SEGMENTO E / HEADER */}
            {(selectedSegmentTab === 'SEGMENTO_E' || selectedSegmentTab === 'HEADER') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Estrutura Posição a Posição ({selectedSegmentTab === 'SEGMENTO_E' ? '240 posições Segmento E' : 'Header'})
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    Clique em uma linha para inspecionar a regra do campo
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Posição (De-Até)</th>
                        <th className="px-4 py-3">Tamanho</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Nome do Campo</th>
                        <th className="px-4 py-3">Descrição & Função da Informação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {(selectedSegmentTab === 'SEGMENTO_E'
                        ? analyzedLayout.segmentoEFields
                        : analyzedLayout.headerArquivoFields
                      ).map((field, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setSelectedFieldPos(field)}
                          className={`cursor-pointer transition-colors ${
                            selectedFieldPos?.nomeCampo === field.nomeCampo
                              ? 'bg-purple-50 font-bold border-l-4 border-purple-600'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-purple-700">
                            {String(field.posInicio).padStart(3, '0')} a {String(field.posFim).padStart(3, '0')}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-600">{field.tamanho} pos</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black font-mono ${
                                field.tipo === 'N' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {field.tipo === 'N' ? 'NUMÉRICO' : 'ALFANUMÉRICO'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900">{field.nomeCampo}</td>
                          <td className="px-4 py-3 text-slate-600">{field.descricao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Inspect Card */}
                {selectedFieldPos && (
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start space-x-3">
                    <div className="p-2 bg-purple-200 text-purple-800 rounded-xl">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-purple-950 uppercase tracking-wider">
                        Campo Selecionado: {selectedFieldPos.nomeCampo}
                      </h5>
                      <p className="text-xs text-purple-900 mt-1 font-medium">
                        {selectedFieldPos.descricao}. Posição: <strong>{selectedFieldPos.posInicio} a {selectedFieldPos.posFim}</strong> ({selectedFieldPos.tamanho} caracteres).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO TAB: TABELA DE CÓDIGOS DE MOVIMENTAÇÃO */}
            {selectedSegmentTab === 'CODES' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Identificação Automática de Códigos de Movimentação (De/Para)
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Estes códigos classificam PIX, TED, DOC, Tarifas, Juros, IOF, Estornos e Aplicações no extrato.
                    </p>
                  </div>
                </div>

                {/* Form Adicionar Código */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Adicionar Novo Código à Tabela de Mapeamento:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Código (ex: 108)"
                      value={newCode.codigo}
                      onChange={(e) => setNewCode({ ...newCode, codigo: e.target.value })}
                      className="bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-600 font-mono font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Descrição (ex: Tarifa Chave PIX)"
                      value={newCode.descricao}
                      onChange={(e) => setNewCode({ ...newCode, descricao: e.target.value })}
                      className="bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-600 font-medium"
                    />
                    <select
                      value={newCode.grupo}
                      onChange={(e) => setNewCode({ ...newCode, grupo: e.target.value as any })}
                      className="bg-white border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-600 font-bold cursor-pointer"
                    >
                      <option value="CREDITO">Crédito / Entrada</option>
                      <option value="DEBITO">Débito / Saída</option>
                      <option value="TARIFA">Tarifa Bancária</option>
                      <option value="IMPOSTO">Juros / IOF / Imposto</option>
                      <option value="INVESTIMENTO">Aplicação / Resgate</option>
                    </select>
                    <button
                      onClick={handleAddCode}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Table Codes */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Descrição / Operação</th>
                        <th className="px-4 py-3">Grupo Financeiro</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {movementCodes.map((item) => (
                        <tr key={item.codigo} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-purple-700">{item.codigo}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{item.descricao}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                item.grupo === 'CREDITO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.grupo === 'DEBITO'
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.grupo === 'TARIFA'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {item.grupo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveCode(item.codigo)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              title="Excluir código"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center border border-purple-100">
            <Brain className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-black text-slate-900">Aguardando Envio de Arquivo CNAB Modelo</h3>
            <p className="text-xs text-slate-500 font-medium">
              Faça o upload de um arquivo de extrato bancário (ex: Santander, Bradesco, Banco do Brasil, Itaú, Caixa) para o sistema aprender automaticamente o layout e salvar o modelo vinculado à empresa e banco.
            </p>
          </div>
        </div>
      )}

      {/* Lista de Layouts já Aprendidos */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <span>Base de Modelos por Empresa e Banco ({savedLayouts.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-bold">
            Clique no card para carregar o modelo ou na lixeira para excluir
          </span>
        </div>

        {savedLayouts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <p className="text-xs text-slate-500 font-medium">Nenhum modelo de layout de extrato cadastrado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedLayouts.map((layout) => (
              <div
                key={layout.id}
                onClick={() => handleSelectSavedLayout(layout)}
                className={`border rounded-2xl p-4 transition-all space-y-2 relative group bg-slate-50/50 cursor-pointer ${
                  analyzedLayout?.id === layout.id
                    ? 'border-purple-600 bg-purple-50/40 shadow-sm ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-purple-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                    CNAB {layout.padraoCNAB}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400 font-bold">
                      Banco {layout.bancoCodigo}
                    </span>
                    <button
                      onClick={(e) => promptDeleteLayout(layout.id, layout.nomeLayout, e)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Excluir este modelo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h4 className="text-xs font-black text-slate-900 line-clamp-1">{layout.nomeLayout}</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Empresa: <strong>{layout.empresaNome || 'Todas as Empresas'}</strong>
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold pt-1 border-t border-slate-200/60">
                  <span>Ag: {layout.agenciaPadrao || 'N/I'} • CC: {layout.contaPadrao || 'N/I'}</span>
                  <span>Usado {layout.timesUsed}x</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Excluir Modelo CNAB?</h3>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Tem certeza que deseja remover o modelo <strong className="text-slate-900">{deleteModalTarget.name}</strong> da sua base de layouts por empresa e banco? Esta ação não poderá ser desfeita.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteModalTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteLayout}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-sm cursor-pointer"
              >
                Sim, Excluir Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
