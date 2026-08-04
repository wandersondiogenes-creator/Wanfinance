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
} from 'lucide-react';
import {
  LearnedCNABExtratoLayout,
  CNABExtratoFieldSpec,
  MovementCodeDefinition,
} from '../../types';
import {
  reverseEngineCnabStructure,
  loadLearnedExtratoLayouts,
  saveLearnedExtratoLayouts,
  MOVEMENT_CODES_DATABASE,
} from '../../utils/cnabExtratoEngine';

interface ModelCnabAnalyzerViewProps {
  onShowToast?: (msg: string) => void;
}

export const ModelCnabAnalyzerView: React.FC<ModelCnabAnalyzerViewProps> = ({ onShowToast }) => {
  const [modelFileName, setModelFileName] = useState('');
  const [analyzedLayout, setAnalyzedLayout] = useState<LearnedCNABExtratoLayout | null>(null);
  const [selectedSegmentTab, setSelectedSegmentTab] = useState<'HEADER' | 'SEGMENTO_E' | 'CODES'>('SEGMENTO_E');
  const [selectedFieldPos, setSelectedFieldPos] = useState<CNABExtratoFieldSpec | null>(null);

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
      const learned = reverseEngineCnabStructure(content, file.name);
      setAnalyzedLayout(learned);
      setSavedLayouts(loadLearnedExtratoLayouts());
      showToast(`Layout do arquivo ${file.name} analisado e aprendido com sucesso!`);
    };

    reader.readAsText(file, 'ISO-8859-1'); // Suporte a caracteres acentuados de bancos
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
                  <span>Opção 2: Modelo CNAB → Aprendizado & Análise</span>
                  <span className="bg-purple-400/20 text-purple-300 text-xs px-2.5 py-0.5 rounded-full border border-purple-400/30 normal-case font-bold">
                    Engenharia Reversa & I.A.
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-purple-200 font-medium">
                  Envie um arquivo CNAB modelo para a IA aprender o layout, identificar posições e mapear códigos de extrato.
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
          {/* Card Resumo do Layout */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                  Layout CNAB Aprendido
                </span>
                <h3 className="text-lg font-black text-slate-900">{analyzedLayout.nomeLayout}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Banco: <strong>{analyzedLayout.bancoNome} ({analyzedLayout.bancoCodigo})</strong> • Padrão: <strong>CNAB {analyzedLayout.padraoCNAB}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Salvo na Base Aprendida</span>
              </span>
            </div>
          </div>

          {/* Abas de Navegação da Análise */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex border-b border-slate-100 pb-2 space-x-4">
              <button
                onClick={() => setSelectedSegmentTab('SEGMENTO_E')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  selectedSegmentTab === 'SEGMENTO_E'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Análise de Campos (Segmento E - Detalhe)
              </button>
              <button
                onClick={() => setSelectedSegmentTab('HEADER')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  selectedSegmentTab === 'HEADER'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Header de Arquivo
              </button>
              <button
                onClick={() => setSelectedSegmentTab('CODES')}
                className={`pb-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  selectedSegmentTab === 'CODES'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Tabela de Códigos de Movimentação
              </button>
            </div>

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
              Faça o upload de um arquivo de extrato bancário (ex: Itaú, Bradesco, BB, Caixa, Santander) para o sistema aprender automaticamente o layout de posições.
            </p>
          </div>
        </div>
      )}

      {/* Lista de Layouts já Aprendidos */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-600" />
          <span>Base de Layouts Aprendidos Continuamente ({savedLayouts.length})</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedLayouts.map((layout) => (
            <div
              key={layout.id}
              className="border border-slate-200 rounded-2xl p-4 hover:border-purple-300 transition-all space-y-2 relative group bg-slate-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">
                  CNAB {layout.padraoCNAB}
                </span>
                <span className="text-[11px] text-slate-400 font-bold">
                  Usado {layout.timesUsed}x
                </span>
              </div>
              <h4 className="text-xs font-black text-slate-900 line-clamp-1">{layout.nomeLayout}</h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Banco: <strong>{layout.bancoNome} ({layout.bancoCodigo})</strong>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
