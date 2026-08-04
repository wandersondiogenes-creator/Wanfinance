import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Download,
  Sliders,
  RefreshCw,
  Search,
  Filter,
  Check,
  FileText,
  DollarSign,
  Building2,
  ListFilter,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ExtratoTransaction,
  ExcelExtratoColumnMapping,
  LearnedCNABExtratoLayout,
  CompanySettings,
} from '../../types';
import {
  loadLearnedExtratoLayouts,
  generateCNABExtratoFile,
  MOVEMENT_CODES_DATABASE,
  saveExtratoConversionHistory,
  loadExtratoConversionHistory,
} from '../../utils/cnabExtratoEngine';
import { formatCurrencyBRL } from '../../utils/boletoParser';

interface ExcelToCnabExtratoViewProps {
  company: CompanySettings;
  onShowToast?: (msg: string) => void;
}

export const ExcelToCnabExtratoView: React.FC<ExcelToCnabExtratoViewProps> = ({
  company,
  onShowToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Mapping & Preview, 3: Success Download
  const [fileName, setFileName] = useState('');
  const [excelRawRows, setExcelRawRows] = useState<any[][]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

  // Column Mapping State
  const [mapping, setMapping] = useState<ExcelExtratoColumnMapping>({
    dataColIndex: 0,
    historicoColIndex: 1,
    valorColIndex: 2,
    tipoColIndex: 3,
    documentoColIndex: 4,
    saldoColIndex: -1,
    codigoMovimentoColIndex: -1,
    categoriaColIndex: -1,
  });

  // Learned Layout Selected for CNAB Generation
  const [learnedLayouts] = useState<LearnedCNABExtratoLayout[]>(() => loadLearnedExtratoLayouts());
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>(learnedLayouts[0]?.id || '');

  // Processed Transactions State
  const [parsedTransactions, setParsedTransactions] = useState<ExtratoTransaction[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'C' | 'D'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Generated CNAB Result
  const [generatedCNAB, setGeneratedCNAB] = useState('');

  const showToast = (msg: string) => {
    if (onShowToast) onShowToast(msg);
    else alert(msg);
  };

  // 1. Handle File Upload (Excel .xlsx / .xls / .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (rawJson.length < 2) {
          alert('A planilha precisa ter pelo menos o cabeçalho e uma linha de dados.');
          return;
        }

        // Tenta encontrar a linha de cabeçalho
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawJson.length, 5); i++) {
          const rowText = rawJson[i].map((c) => String(c).toLowerCase()).join(' ');
          if (rowText.includes('data') || rowText.includes('valor') || rowText.includes('historico') || rowText.includes('descri')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = rawJson[headerRowIndex].map((h, idx) => String(h || `Coluna ${idx + 1}`).trim());
        const dataRows = rawJson.slice(headerRowIndex + 1).filter((r) => r.some((c) => c !== '' && c !== null));

        setExcelHeaders(headers);
        setExcelRawRows(dataRows);

        // Auto-detect Column Indices
        const autoMap: ExcelExtratoColumnMapping = {
          dataColIndex: -1,
          historicoColIndex: -1,
          valorColIndex: -1,
          tipoColIndex: -1,
          documentoColIndex: -1,
          saldoColIndex: -1,
          codigoMovimentoColIndex: -1,
          categoriaColIndex: -1,
        };

        headers.forEach((h, idx) => {
          const norm = h.toLowerCase();
          if (norm.includes('data') || norm.includes('lancamento') || norm.includes('dt')) autoMap.dataColIndex = idx;
          else if (norm.includes('historico') || norm.includes('descri') || norm.includes('detalhe') || norm.includes('memo')) autoMap.historicoColIndex = idx;
          else if (norm.includes('valor') || norm.includes('quantia') || norm.includes('monto')) autoMap.valorColIndex = idx;
          else if (norm.includes('tipo') || norm.includes('c/d') || norm.includes('sinal') || norm.includes('natureza')) autoMap.tipoColIndex = idx;
          else if (norm.includes('doc') || norm.includes('nsu') || norm.includes('ref') || norm.includes('comprovante')) autoMap.documentoColIndex = idx;
          else if (norm.includes('saldo')) autoMap.saldoColIndex = idx;
          else if (norm.includes('categoria') || norm.includes('grupo')) autoMap.categoriaColIndex = idx;
        });

        // Preenche fallbacks caso algum não seja localizado
        if (autoMap.dataColIndex === -1) autoMap.dataColIndex = 0;
        if (autoMap.historicoColIndex === -1) autoMap.historicoColIndex = headers.length > 1 ? 1 : 0;
        if (autoMap.valorColIndex === -1) autoMap.valorColIndex = headers.length > 2 ? 2 : 0;

        setMapping(autoMap);
        processRowsToTransactions(dataRows, autoMap);
        setStep(2);
      } catch (err) {
        console.error('Erro ao ler planilha Excel:', err);
        alert('Erro ao processar o arquivo Excel. Verifique se o formato está correto.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 2. Parse Rows into Normalized Transactions
  const processRowsToTransactions = (rows: any[][], map: ExcelExtratoColumnMapping) => {
    const txList: ExtratoTransaction[] = [];

    rows.forEach((row, idx) => {
      const rawDate = String(row[map.dataColIndex] || '').trim();
      const rawHist = String(row[map.historicoColIndex] || '').trim();
      const rawVal = row[map.valorColIndex];
      const rawTipo = map.tipoColIndex !== -1 ? String(row[map.tipoColIndex] || '').toUpperCase().trim() : '';
      const rawDoc = map.documentoColIndex !== -1 ? String(row[map.documentoColIndex] || '').trim() : '';

      if (!rawDate && !rawHist && (rawVal === undefined || rawVal === '')) return;

      // Parse Value
      let valNumber = 0;
      if (typeof rawVal === 'number') {
        valNumber = rawVal;
      } else if (typeof rawVal === 'string') {
        const clean = rawVal.replace(/[R\$\s]/g, '').replace(/\./g, '').replace(',', '.');
        valNumber = parseFloat(clean) || 0;
      }

      // Determine Type (Credit 'C' or Debit 'D')
      let tipo: 'C' | 'D' = 'C';
      if (rawTipo.includes('D') || rawTipo.includes('SAIDA') || rawTipo.includes('DEBITO') || rawTipo.includes('-')) {
        tipo = 'D';
      } else if (rawTipo.includes('C') || rawTipo.includes('ENTRADA') || rawTipo.includes('CREDITO') || rawTipo.includes('+')) {
        tipo = 'C';
      } else {
        // Fallback p/ sinal do valor
        tipo = valNumber < 0 ? 'D' : 'C';
      }

      const absVal = Math.abs(valNumber);

      // Auto-classify movement code & category
      const { codigo, categoria } = MOVEMENT_CODES_DATABASE.identifyCodeFromHistory(rawHist, tipo);

      // Format Date YYYY-MM-DD
      let formattedDate = new Date().toISOString().split('T')[0];
      if (rawDate) {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
          const [d, m, y] = rawDate.split('/');
          formattedDate = `${y}-${m}-${d}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          formattedDate = rawDate;
        }
      }

      txList.push({
        id: `tx-excel-${idx + 1}-${Date.now().toString(36)}`,
        dataLancamento: formattedDate,
        historico: rawHist || 'Lançamento de Extrato',
        documentoRef: rawDoc || `${idx + 1001}`,
        valor: absVal,
        tipo,
        codigoMovimento: codigo,
        categoria,
        valid: absVal > 0,
      });
    });

    setParsedTransactions(txList);
  };

  // Re-process when column mapping changes
  const handleMappingChange = (key: keyof ExcelExtratoColumnMapping, colIndex: number) => {
    const updated = { ...mapping, [key]: colIndex };
    setMapping(updated);
    processRowsToTransactions(excelRawRows, updated);
  };

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return parsedTransactions.filter((tx) => {
      const matchType = filterType === 'ALL' || tx.tipo === filterType;
      const matchSearch =
        tx.historico.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.documentoRef && tx.documentoRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.categoria && tx.categoria.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchType && matchSearch;
    });
  }, [parsedTransactions, filterType, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    let creditos = 0;
    let debitos = 0;
    parsedTransactions.forEach((t) => {
      if (t.tipo === 'C') creditos += t.valor;
      else debitos += t.valor;
    });
    return { creditos, debitos, saldo: creditos - debitos };
  }, [parsedTransactions]);

  // Generate CNAB Extrato
  const handleGenerateCNAB = () => {
    if (parsedTransactions.length === 0) {
      alert('Nenhuma transação válida para conversão.');
      return;
    }

    const targetLayout = learnedLayouts.find((l) => l.id === selectedLayoutId) || learnedLayouts[0];
    const cnabText = generateCNABExtratoFile(parsedTransactions, company, targetLayout);

    setGeneratedCNAB(cnabText);

    // Save to conversion history
    const historyRecord = {
      id: `extrato-conv-${Date.now()}`,
      dataConversao: new Date().toISOString(),
      nomeArquivoOriginal: fileName,
      nomeArquivoCNAB: `EXTRATO_${company.bancoCodigo || '341'}_${Date.now().toString(36)}.ret`,
      qtdLancamentos: parsedTransactions.length,
      totalCreditos: totals.creditos,
      totalDebitos: totals.debitos,
      bancoCodigo: company.bancoCodigo || targetLayout.bancoCodigo,
      layoutNome: targetLayout.nomeLayout,
      cnabContent: cnabText,
    };

    const currentHistory = loadExtratoConversionHistory();
    currentHistory.unshift(historyRecord);
    saveExtratoConversionHistory(currentHistory);

    setStep(3);
    showToast('CNAB de Extrato gerado com sucesso!');
  };

  // Download CNAB File
  const handleDownloadCNAB = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedCNAB], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `EXTRATO_CNAB240_${company.bancoCodigo || '341'}_${Date.now().toString().slice(-6)}.ret`;
    document.body.appendChild(element);
    element.click();
    element.remove();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner Opção 1 */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                  <span>Opção 1: Planilha Excel → CNAB Extrato</span>
                  <span className="bg-emerald-400/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-400/30 normal-case font-bold">
                    Mapeamento & Validação
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-emerald-200 font-medium">
                  Envie sua planilha de lançamentos bancários, mapeie as colunas e converta para CNAB 240 de Extrato.
                </p>
              </div>
            </div>
          </div>

          {step > 1 && (
            <button
              onClick={() => {
                setStep(1);
                setExcelRawRows([]);
                setParsedTransactions([]);
              }}
              className="bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 text-xs font-bold px-4 py-2.5 rounded-xl border border-emerald-700 transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Enviar Outra Planilha</span>
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: UPLOAD EXCEL */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs text-center space-y-6">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-100 shadow-sm">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                Selecione ou Arraste sua Planilha de Extrato
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Suporta arquivos nos formatos <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong> com colunas de Data, Histórico e Valor.
              </p>
            </div>

            <label className="block cursor-pointer">
              <span className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all inline-flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Procurar Arquivo Excel</span>
              </span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: MAPPING & INTERACTIVE PREVIEW */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Column Mapping Toolbar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Mapeamento Inteligente de Colunas ({fileName})
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Ajuste a correspondência entre as colunas da sua planilha e os campos do extrato CNAB.
                  </p>
                </div>
              </div>

              {/* Layout Target Select */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Layout CNAB Alvo:</label>
                <select
                  value={selectedLayoutId}
                  onChange={(e) => setSelectedLayoutId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-3 py-2 rounded-xl font-bold focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {learnedLayouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nomeLayout} ({l.bancoCodigo})
                    </option>
                  ))}
                </select>
                {learnedLayouts.find((l) => l.id === selectedLayoutId)?.sampleSegmentE && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Espelhamento Fiel de Arquivo Modelo Ativo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Selects Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Data do Lançamento *
                </label>
                <select
                  value={mapping.dataColIndex}
                  onChange={(e) => handleMappingChange('dataColIndex', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {excelHeaders.map((h, i) => (
                    <option key={i} value={i}>
                      Col {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Descrição / Histórico *
                </label>
                <select
                  value={mapping.historicoColIndex}
                  onChange={(e) => handleMappingChange('historicoColIndex', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {excelHeaders.map((h, i) => (
                    <option key={i} value={i}>
                      Col {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Valor do Lançamento *
                </label>
                <select
                  value={mapping.valorColIndex}
                  onChange={(e) => handleMappingChange('valorColIndex', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {excelHeaders.map((h, i) => (
                    <option key={i} value={i}>
                      Col {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Tipo (Crédito / Débito)
                </label>
                <select
                  value={mapping.tipoColIndex}
                  onChange={(e) => handleMappingChange('tipoColIndex', Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-xl font-medium focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value={-1}>Detectar pelo Sinal (+ / -)</option>
                  {excelHeaders.map((h, i) => (
                    <option key={i} value={i}>
                      Col {i + 1}: {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Totals & Action Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Total de Entradas (Créditos)
                </span>
                <span className="text-xl font-black text-emerald-700 mt-0.5 block">
                  {formatCurrencyBRL(totals.creditos)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                +
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">
                  Total de Saídas (Débitos)
                </span>
                <span className="text-xl font-black text-rose-700 mt-0.5 block">
                  {formatCurrencyBRL(totals.debitos)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                -
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Lançamentos Identificados
                </span>
                <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                  {parsedTransactions.length} <span className="text-xs text-slate-400 font-normal">itens</span>
                </span>
              </div>
              <button
                onClick={handleGenerateCNAB}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Gerar CNAB</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Transactions Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Pré-visualização dos Lançamentos ({filteredTransactions.length})
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar no histórico..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-emerald-600 font-medium"
                  />
                </div>

                {/* Filter Type */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setFilterType('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterType('C')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterType === 'C' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Créditos
                  </button>
                  <button
                    onClick={() => setFilterType('D')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterType === 'D' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Débitos
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Descrição / Histórico</th>
                    <th className="px-4 py-3">Doc / NSU</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Cód Mov</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold">{tx.dataLancamento}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{tx.historico}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{tx.documentoRef || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          {tx.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{tx.codigoMovimento}</td>
                      <td className={`px-4 py-3 text-right font-black font-mono ${tx.tipo === 'C' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.tipo === 'C' ? '+' : '-'} {formatCurrencyBRL(tx.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS & DOWNLOAD */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs text-center space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center font-bold">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">
              Arquivo CNAB 240 de Extrato Gerado com Sucesso!
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Seu extrato bancário foi formatado rigorosamente de acordo com o padrão Febraban de 240 colunas.
            </p>
          </div>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs text-left max-h-48 overflow-y-auto space-y-1">
            <p className="text-emerald-400 font-bold">// Prévia das primeiras linhas geradas:</p>
            {generatedCNAB.split('\n').slice(0, 5).map((l, idx) => (
              <p key={idx} className="truncate text-slate-300">
                {l}
              </p>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleDownloadCNAB}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo CNAB (.RET)</span>
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-5 py-3.5 rounded-2xl transition-colors cursor-pointer"
            >
              Converter Outra Planilha
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
