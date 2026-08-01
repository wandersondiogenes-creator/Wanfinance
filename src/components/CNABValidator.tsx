import React, { useState, useMemo } from 'react';
import { BoletoItem, CompanySettings } from '../types';
import { getBankInfo } from '../utils/banks';
import { generateCNAB240 } from '../utils/cnabGenerator240';
import { generateCNAB400 } from '../utils/cnabGenerator400';
import {
  ShieldCheck,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  Building2,
  Layers,
  FileCode,
  ArrowRight,
  ListFilter,
  UserCheck,
} from 'lucide-react';

interface CNABValidatorProps {
  boletos?: BoletoItem[];
  activeCompany?: CompanySettings;
  onSaveToHistory?: (
    fileContent: string,
    totalBoletos: number,
    totalValor: number,
    filename: string,
    nsa: number,
    analista?: string
  ) => void;
  showToast?: (text: string, type?: 'success' | 'error') => void;
}

export const CNABValidator: React.FC<CNABValidatorProps> = ({
  boletos = [],
  activeCompany,
  onSaveToHistory,
  showToast,
}) => {
  const [fileContent, setFileContent] = useState('');
  const [useModelCompanyData, setUseModelCompanyData] = useState(true);
  const [boletoSelectionMode, setBoletoSelectionMode] = useState<'ALL_VALID' | 'SELECTED_ONLY'>('ALL_VALID');
  const [analista, setAnalista] = useState(() => localStorage.getItem('last_analyst_name') || '');

  const [generatedResult, setGeneratedResult] = useState<{
    fileContent: string;
    totalBoletos: number;
    totalValor: number;
    padrao: '240' | '400';
    filename: string;
    highlights: any[];
    bancoCodigo: string;
    bancoNome: string;
    empresaNome: string;
  } | null>(null);

  const [selectedGeneratedLineIndex, setSelectedGeneratedLineIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);

  // Validate uploaded / pasted CNAB content
  const validationResult = useMemo(() => {
    if (!fileContent.trim()) return null;

    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.replace(/\r/g, ''))
      .filter((l) => l.length > 0);

    if (lines.length === 0) return null;

    const lineLengths = lines.map((l) => l.length);
    const firstLineLength = lineLengths[0];

    const isCNAB240 = firstLineLength === 240;
    const isCNAB400 = firstLineLength === 400;

    const invalidLengths = lineLengths.filter((len) => len !== firstLineLength);

    // Extract bank code
    let bancoCodigo = '001';
    if (isCNAB240) {
      bancoCodigo = lines[0].substring(0, 3);
    } else if (isCNAB400) {
      bancoCodigo = lines[0].substring(77, 80) || lines[0].substring(0, 3);
      if (!/^\d{3}$/.test(bancoCodigo)) {
        bancoCodigo = lines[0].substring(0, 3);
      }
    } else {
      bancoCodigo = lines[0].substring(0, 3);
    }

    const bankInfo = getBankInfo(bancoCodigo);

    // Basic structure checks
    const issues: string[] = [];
    if (!isCNAB240 && !isCNAB400) {
      issues.push(`Comprimento de linha atípico: ${firstLineLength} caracteres (esperado 240 ou 400).`);
    }

    if (invalidLengths.length > 0) {
      issues.push(`Existem ${invalidLengths.length} linhas com tamanhos divergentes da primeira linha.`);
    }

    // Extract company / account details from header
    let extractedCompany: {
      padraoCNAB: '240' | '400';
      bancoCodigo: string;
      bancoNome: string;
      razaoSocial: string;
      cnpjCpf: string;
      tipoInscricao: 'CNPJ' | 'CPF';
      agencia: string;
      agenciaDV: string;
      conta: string;
      contaDV: string;
      convenio: string;
      nsa: number;
    } = {
      padraoCNAB: isCNAB240 ? '240' : '400',
      bancoCodigo,
      bancoNome: bankInfo.shortName,
      razaoSocial: 'EMPRESA MODELO CNAB',
      cnpjCpf: '00000000000000',
      tipoInscricao: 'CNPJ',
      agencia: '0001',
      agenciaDV: '0',
      conta: '00001',
      contaDV: '0',
      convenio: '',
      nsa: 1,
    };

    if (isCNAB240 && lines[0].length >= 240) {
      const h = lines[0];
      const cnpjCpfExtracted = h.substring(18, 32).trim();
      const convenioExtracted = h.substring(32, 52).trim();
      const agExtracted = h.substring(52, 57).trim();
      const agDVExtracted = h.substring(57, 58).trim();
      const contaExtracted = h.substring(58, 70).trim();
      const contaDVExtracted = h.substring(70, 71).trim();
      const razaoExtracted = h.substring(72, 102).trim();
      const bancoNomeExtracted = h.substring(102, 132).trim();
      const nsaExtracted = parseInt(h.substring(157, 163), 10);

      extractedCompany = {
        padraoCNAB: '240',
        bancoCodigo,
        bancoNome: bancoNomeExtracted || bankInfo.shortName,
        razaoSocial: razaoExtracted || 'EMPRESA MODELO CNAB',
        cnpjCpf: cnpjCpfExtracted || '00000000000000',
        tipoInscricao: (cnpjCpfExtracted.length > 11 ? 'CNPJ' : 'CPF') as 'CNPJ' | 'CPF',
        agencia: agExtracted || '0001',
        agenciaDV: agDVExtracted || '0',
        conta: contaExtracted || '00001',
        contaDV: contaDVExtracted || '0',
        convenio: convenioExtracted || '',
        nsa: isNaN(nsaExtracted) || nsaExtracted === 0 ? 1 : nsaExtracted,
      };

      if (h.charAt(7) !== '0') {
        issues.push('A primeira linha não possui indicador de Header de Arquivo (Tipo 0 na Pos 8).');
      }
      const trailer = lines[lines.length - 1];
      if (trailer && trailer.charAt(7) !== '9') {
        issues.push('A última linha não possui indicador de Trailer de Arquivo (Tipo 9 na Pos 8).');
      }
    }

    if (isCNAB400 && lines[0].length >= 400) {
      const h = lines[0];
      const agExtracted = h.substring(26, 30).trim();
      const agDVExtracted = h.substring(30, 31).trim();
      const contaExtracted = h.substring(31, 38).trim();
      const contaDVExtracted = h.substring(38, 39).trim();
      const convenioExtracted = h.substring(39, 47).trim();
      const razaoExtracted = h.substring(47, 77).trim();
      const bancoNomeExtracted = h.substring(80, 95).trim();
      const nsaExtracted = parseInt(h.substring(394, 400), 10);

      extractedCompany = {
        padraoCNAB: '400',
        bancoCodigo,
        bancoNome: bancoNomeExtracted || bankInfo.shortName,
        razaoSocial: razaoExtracted || 'EMPRESA MODELO CNAB',
        cnpjCpf: activeCompany?.cnpjCpf || '00000000000000',
        tipoInscricao: 'CNPJ',
        agencia: agExtracted || '0001',
        agenciaDV: agDVExtracted || '0',
        conta: contaExtracted || '00001',
        contaDV: contaDVExtracted || '0',
        convenio: convenioExtracted || '',
        nsa: isNaN(nsaExtracted) || nsaExtracted === 0 ? 1 : nsaExtracted,
      };

      if (h.charAt(0) !== '0') {
        issues.push('A primeira linha não possui indicador de Header de Arquivo (Tipo 0 na Pos 1).');
      }
      const trailer = lines[lines.length - 1];
      if (trailer && trailer.charAt(0) !== '9') {
        issues.push('A última linha não possui indicador de Trailer de Arquivo (Tipo 9 na Pos 1).');
      }
    }

    return {
      padrao: isCNAB240 ? ('240' as const) : isCNAB400 ? ('400' as const) : ('DESCONHECIDO' as const),
      totalLinhas: lines.length,
      bancoCodigo,
      bancoNome: bankInfo.shortName,
      tamanhoLinha: firstLineLength,
      isValid: issues.length === 0,
      issues,
      lines,
      extractedCompany,
    };
  }, [fileContent, activeCompany]);

  // Boletos counts
  const validBoletos = useMemo(() => boletos.filter((b) => b.isValid), [boletos]);
  const selectedBoletos = useMemo(() => boletos.filter((b) => b.selected && b.isValid), [boletos]);

  const targetBoletos = boletoSelectionMode === 'SELECTED_ONLY' ? selectedBoletos : validBoletos;

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setFileContent(text);
        setGeneratedResult(null);
      }
    };
    reader.readAsText(file);
  };

  // Generate CNAB using the uploaded model layout
  const handleGenerateFromModel = () => {
    if (!validationResult || (validationResult.padrao !== '240' && validationResult.padrao !== '400')) {
      if (showToast) showToast('Envie ou cole um arquivo CNAB 240 ou 400 válido para usar como modelo.', 'error');
      return;
    }

    if (targetBoletos.length === 0) {
      if (showToast)
        showToast(
          boletoSelectionMode === 'SELECTED_ONLY'
            ? 'Nenhum boleto selecionado para incluir na remessa.'
            : 'Nenhum boleto válido cadastrado para incluir na remessa.',
          'error'
        );
      return;
    }

    // Determine company profile to use
    let companyToUse: CompanySettings;

    if (useModelCompanyData) {
      companyToUse = {
        razaoSocial: validationResult.extractedCompany.razaoSocial,
        cnpjCpf: validationResult.extractedCompany.cnpjCpf,
        tipoInscricao: validationResult.extractedCompany.tipoInscricao,
        bancoCodigo: validationResult.bancoCodigo,
        bancoNome: validationResult.bancoNome,
        agencia: validationResult.extractedCompany.agencia,
        agenciaDV: validationResult.extractedCompany.agenciaDV,
        conta: validationResult.extractedCompany.conta,
        contaDV: validationResult.extractedCompany.contaDV,
        convenio: validationResult.extractedCompany.convenio,
        padraoCNAB: validationResult.padrao,
        nsa: validationResult.extractedCompany.nsa || 1,
        logradouro: '',
        numero: '',
        complemento: '',
        cidade: '',
        uf: '',
        cep: '',
        layoutVersaoLote: '040',
      };
    } else if (activeCompany) {
      companyToUse = {
        ...activeCompany,
        padraoCNAB: validationResult.padrao,
      };
    } else {
      companyToUse = {
        razaoSocial: 'SUA EMPRESA LTDA',
        cnpjCpf: '12345678000195',
        tipoInscricao: 'CNPJ',
        bancoCodigo: validationResult.bancoCodigo,
        bancoNome: validationResult.bancoNome,
        agencia: '0001',
        agenciaDV: '0',
        conta: '00001',
        contaDV: '0',
        convenio: '',
        padraoCNAB: validationResult.padrao,
        nsa: 1,
        logradouro: '',
        numero: '',
        complemento: '',
        cidade: '',
        uf: '',
        cep: '',
        layoutVersaoLote: '040',
      };
    }

    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
    const filename = `CB${todayStr}${String(companyToUse.nsa).padStart(2, '0')}.REM`;

    if (validationResult.padrao === '400') {
      const res = generateCNAB400(companyToUse, targetBoletos);
      setGeneratedResult({
        fileContent: res.fileContent,
        totalBoletos: res.totalBoletos,
        totalValor: res.totalValor,
        padrao: '400',
        filename,
        highlights: res.highlights,
        bancoCodigo: companyToUse.bancoCodigo,
        bancoNome: companyToUse.bancoNome,
        empresaNome: companyToUse.razaoSocial,
      });
    } else {
      const res = generateCNAB240(companyToUse, targetBoletos);
      setGeneratedResult({
        fileContent: res.fileContent,
        totalBoletos: res.totalBoletos,
        totalValor: res.totalValor,
        padrao: '240',
        filename,
        highlights: res.highlights,
        bancoCodigo: companyToUse.bancoCodigo,
        bancoNome: companyToUse.bancoNome,
        empresaNome: companyToUse.razaoSocial,
      });
    }

    setSelectedGeneratedLineIndex(0);
    if (showToast) showToast(`Novo arquivo CNAB ${validationResult.padrao} gerado com base no modelo!`);
  };

  // Download Generated CNAB
  const handleDownloadGenerated = () => {
    if (!generatedResult) return;
    const formattedAnalyst = analista.trim() || 'Analista Financeiro';
    localStorage.setItem('last_analyst_name', formattedAnalyst);

    const blob = new Blob([generatedResult.fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generatedResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onSaveToHistory) {
      onSaveToHistory(
        generatedResult.fileContent,
        generatedResult.totalBoletos,
        generatedResult.totalValor,
        generatedResult.filename,
        1,
        formattedAnalyst
      );
    }
  };

  // Copy Generated CNAB
  const handleCopyGenerated = () => {
    if (!generatedResult) return;
    navigator.clipboard.writeText(generatedResult.fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (showToast) showToast('Conteúdo do arquivo CNAB copiado!');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>Validador & Criador de CNAB por Modelo</span>
              <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                Novo
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Envie um arquivo CNAB modelo (.REM/.TXT) para validar a sintaxe e recriar uma nova remessa no mesmo formato usando os boletos importados.
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Arquivo Modelo CNAB (.REM / .TXT)
            </label>
            <p className="text-[11px] text-slate-500 font-medium">
              Cole o texto ou faça upload do modelo do seu banco parceiro.
            </p>
          </div>

          <label className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors flex items-center space-x-2 shrink-0">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Enviar Modelo .REM</span>
            <input type="file" accept=".rem,.txt,.cnab" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        <textarea
          rows={6}
          value={fileContent}
          onChange={(e) => {
            setFileContent(e.target.value);
            setGeneratedResult(null);
          }}
          placeholder="Cole aqui o texto do seu arquivo modelo CNAB 240 ou CNAB 400..."
          className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono rounded-xl p-4 focus:outline-none focus:border-blue-600 focus:bg-white placeholder:text-slate-400 font-medium"
        />
      </div>

      {/* Validation Result & Template Model Generator Controls */}
      {validationResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Validation Header Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-3">
                {validationResult.isValid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>Modelo Identificado: {validationResult.padrao}</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">({validationResult.tamanhoLinha} posições)</span>
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Banco: <strong className="text-slate-900">[{validationResult.bancoCodigo}] {validationResult.bancoNome}</strong> | {validationResult.totalLinhas} linha(s) no modelo
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  validationResult.isValid
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {validationResult.isValid ? 'Sintaxe Válida' : 'Alertas no Modelo'}
              </span>
            </div>

            {validationResult.issues.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs space-y-1">
                <p className="font-extrabold mb-1">Alertas Identificados no Modelo:</p>
                <ul className="list-disc list-inside space-y-1 font-medium">
                  {validationResult.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Model Header Parameters Extracted */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                Dados Extraídos do Cabeçalho do Modelo:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-medium">Empresa/Razão:</span>
                  <span className="font-extrabold text-slate-900 truncate block">
                    {validationResult.extractedCompany.razaoSocial}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-medium">Agência / Conta:</span>
                  <span className="font-extrabold text-slate-900">
                    {validationResult.extractedCompany.agencia} / {validationResult.extractedCompany.conta}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-medium">Convênio:</span>
                  <span className="font-extrabold text-slate-900">
                    {validationResult.extractedCompany.convenio || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans font-medium">Layout CNAB:</span>
                  <span className="font-extrabold text-blue-700">
                    {validationResult.padrao} ({validationResult.bancoCodigo})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Re-Generation Control Panel */}
          {validationResult.padrao !== 'DESCONHECIDO' && (
            <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-6 space-y-5 shadow-xs">
              <div className="flex items-start justify-between gap-4 border-b border-blue-200 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Gerar Remessa CNAB {validationResult.padrao} com os Boletos Importados
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      Recrie uma remessa formatada identicamente ao modelo acima, preenchida automaticamente com seus boletos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Option 1: Company Profile Source */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-2 shadow-2xs">
                  <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                    1. Dados de Conta / Cabeçalho
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="companySource"
                        checked={useModelCompanyData}
                        onChange={() => setUseModelCompanyData(true)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-800 font-medium">
                        Usar Dados do Modelo (<strong className="text-slate-900">{validationResult.extractedCompany.razaoSocial}</strong>)
                      </span>
                    </label>

                    {activeCompany && (
                      <label className="flex items-center space-x-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="companySource"
                          checked={!useModelCompanyData}
                          onChange={() => setUseModelCompanyData(false)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-800 font-medium">
                          Usar Minha Empresa Ativa (<strong className="text-slate-900">{activeCompany.razaoSocial}</strong> - Ag: {activeCompany.agencia})
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Option 2: Boletos Selection */}
                <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-2 shadow-2xs">
                  <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                    2. Boletos a Incluir no Arquivo
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="boletoSelection"
                        checked={boletoSelectionMode === 'ALL_VALID'}
                        onChange={() => setBoletoSelectionMode('ALL_VALID')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-800 font-medium">
                        Todos os Boletos Válidos (<strong className="text-emerald-700">{validBoletos.length} boleto(s)</strong>)
                      </span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="boletoSelection"
                        checked={boletoSelectionMode === 'SELECTED_ONLY'}
                        onChange={() => setBoletoSelectionMode('SELECTED_ONLY')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-800 font-medium">
                        Apenas os Selecionados (<strong className="text-blue-700">{selectedBoletos.length} boleto(s)</strong>)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Option 3: Analyst Name */}
              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                    3. Analista Financeiro Responsável
                  </label>
                </div>
                <input
                  type="text"
                  value={analista}
                  onChange={(e) => setAnalista(e.target.value)}
                  placeholder="Nome do analista (ex: Carlos Andrade)"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              {/* Generate Action Button */}
              <button
                onClick={handleGenerateFromModel}
                disabled={targetBoletos.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>
                  Gerar Arquivo CNAB {validationResult.padrao} com os {targetBoletos.length} Boletos Importados
                </span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {/* Generated Result Section */}
          {generatedResult && (
            <div className="bg-white border border-blue-200 rounded-2xl p-6 space-y-5 shadow-xs animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-extrabold text-slate-900">
                        Remessa Gerada Baseada no Modelo ({generatedResult.padrao})
                      </h3>
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 text-xs font-mono px-2 py-0.5 rounded-full font-bold">
                        {generatedResult.filename}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 font-medium">
                      {generatedResult.totalBoletos} boleto(s) incluídos | Total: R${' '}
                      <strong className="text-blue-700 font-mono">{generatedResult.totalValor.toFixed(2)}</strong> | Empresa: {generatedResult.empresaNome}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                  <button
                    onClick={handleCopyGenerated}
                    className="flex-1 sm:flex-initial bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>

                  <button
                    onClick={handleDownloadGenerated}
                    className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo .REM</span>
                  </button>
                </div>
              </div>

              {/* Line Inspector */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Linhas do Arquivo CNAB Recriado ({generatedResult.fileContent.split('\r\n').length} linhas)
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs overflow-x-auto max-h-56 divide-y divide-slate-800/40 text-slate-200">
                  {generatedResult.fileContent.split('\r\n').map((line, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedGeneratedLineIndex(idx)}
                      className={`py-1.5 px-2 rounded cursor-pointer transition-colors flex items-center space-x-3 ${
                        selectedGeneratedLineIndex === idx
                          ? 'bg-blue-900/90 text-blue-100 border border-blue-400'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500 font-bold w-6 text-right shrink-0">{idx + 1}</span>
                      <span className="whitespace-pre">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Model Raw Line Preview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2 shadow-xs">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Visualização de Linhas do Modelo Importado ({validationResult.lines.length} linhas)
            </p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs overflow-x-auto max-h-48 divide-y divide-slate-800/40 text-slate-200">
              {validationResult.lines.map((line, idx) => (
                <div key={idx} className="py-1 flex items-center space-x-2">
                  <span className="text-slate-500 font-bold w-6 text-right shrink-0">{idx + 1}</span>
                  <span className="text-slate-300 whitespace-pre">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
