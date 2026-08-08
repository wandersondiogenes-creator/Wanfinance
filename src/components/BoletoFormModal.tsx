import React, { useState, useEffect, useMemo } from 'react';
import { BoletoItem, CNABBatchHistory, BoletoType } from '../types';
import { parseLinhaDigitavel, formatLinhaDigitavelDisplay, formatCurrencyBRL, onlyNumbers, validateAndClampPaymentDate } from '../utils/boletoParser';
import { getBankInfo, BRAZILIAN_BANKS } from '../utils/banks';
import { X, CheckCircle, AlertCircle, Sparkles, Building2, Calendar, DollarSign, Tag, FileText, AlertTriangle, Percent, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { detectBoletoDuplicate } from '../utils/duplicateDetector';

interface BoletoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (boleto: BoletoItem) => void;
  initialData?: BoletoItem | null;
  existingBoletos?: BoletoItem[];
  history?: CNABBatchHistory[];
}

export const BoletoFormModal: React.FC<BoletoFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingBoletos = [],
  history = [],
}) => {
  const [linhaDigitavel, setLinhaDigitavel] = useState('');
  const [favorecidoNome, setFavorecidoNome] = useState('');
  const [favorecidoCnpjCpf, setFavorecidoCnpjCpf] = useState('');
  const [valor, setValor] = useState<number | string>(0);
  const [dataVencimento, setDataVencimento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [seuNumero, setSeuNumero] = useState('');
  const [desconto, setDesconto] = useState<number | string>(0);
  const [jurosMulta, setJurosMulta] = useState<number | string>(0);
  const [categoria, setCategoria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [bancoCodigo, setBancoCodigo] = useState('001');
  const [tipoBoleto, setTipoBoleto] = useState<BoletoType>('titulo_bancario');
  const [placa, setPlaca] = useState('');
  const [renavam, setRenavam] = useState('');
  const [autoInfracao, setAutoInfracao] = useState('');

  const [parseStatus, setParseStatus] = useState<{
    isValid: boolean;
    bancoNome: string;
    bancoCodigo: string;
    errorMessage?: string;
  }>({ isValid: false, bancoNome: '', bancoCodigo: '001' });

  // Compute duplicate status in real time
  const duplicateInfo = useMemo(() => {
    if (!linhaDigitavel && !seuNumero) return null;

    const candidate = {
      id: initialData?.id,
      linhaDigitavel,
      codigoBarras: linhaDigitavel.replace(/\D/g, ''),
      seuNumero,
      favorecidoCnpjCpf,
    };

    return detectBoletoDuplicate(candidate, [], existingBoletos, history);
  }, [linhaDigitavel, seuNumero, favorecidoCnpjCpf, initialData, existingBoletos, history]);

  // Reset form when opened or initialData changes
  useEffect(() => {
    if (initialData) {
      setLinhaDigitavel(initialData.linhaDigitavel);
      setFavorecidoNome(initialData.favorecidoNome);
      setFavorecidoCnpjCpf(initialData.favorecidoCnpjCpf || '');
      setValor(initialData.valor);
      setDataVencimento(initialData.dataVencimento);
      setDataPagamento(initialData.dataPagamento || initialData.dataVencimento);
      setSeuNumero(initialData.seuNumero);
      setDesconto(initialData.desconto || 0);
      setJurosMulta(initialData.jurosMulta || 0);
      setCategoria(initialData.categoria || '');
      setObservacoes(initialData.observacoes || '');
      setBancoCodigo(initialData.bancoCodigo);
      setTipoBoleto(initialData.tipoBoleto || 'titulo_bancario');
      setPlaca(initialData.placa || '');
      setRenavam(initialData.renavam || '');
      setAutoInfracao(initialData.autoInfracao || '');
      setParseStatus({
        isValid: initialData.isValid,
        bancoNome: initialData.bancoNome,
        bancoCodigo: initialData.bancoCodigo,
      });
    } else {
      setLinhaDigitavel('');
      setFavorecidoNome('');
      setFavorecidoCnpjCpf('');
      setValor(0);
      const today = new Date().toISOString().split('T')[0];
      setDataVencimento(today);
      setDataPagamento(today);
      setSeuNumero(`NF-${Math.floor(1000 + Math.random() * 9000)}`);
      setDesconto(0);
      setJurosMulta(0);
      setCategoria('Fornecedores');
      setObservacoes('');
      setBancoCodigo('001');
      setTipoBoleto('titulo_bancario');
      setPlaca('');
      setRenavam('');
      setAutoInfracao('');
      setParseStatus({ isValid: false, bancoNome: '', bancoCodigo: '001' });
    }
  }, [initialData, isOpen]);

  // Real-time automatic line parsing
  const handleLinhaDigitavelChange = (val: string) => {
    setLinhaDigitavel(val);

    if (val.trim().length >= 44) {
      const parsed = parseLinhaDigitavel(val);
      if (parsed.isValid) {
        setParseStatus({
          isValid: true,
          bancoNome: parsed.bancoNome,
          bancoCodigo: parsed.bancoCodigo,
        });
        setBancoCodigo(parsed.bancoCodigo);

        if (parsed.valor > 0) {
          setValor(parsed.valor);
        }
        if (parsed.dataVencimento) {
          setDataVencimento(parsed.dataVencimento);
          setDataPagamento(parsed.dataVencimento);
        }
      } else {
        setParseStatus({
          isValid: false,
          bancoNome: parsed.bancoNome,
          bancoCodigo: parsed.bancoCodigo,
          errorMessage: parsed.errorMessage,
        });
      }
    } else {
      setParseStatus({ isValid: false, bancoNome: '', bancoCodigo: '001' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = parseLinhaDigitavel(linhaDigitavel);
    const bankInfo = getBankInfo(bancoCodigo);

    const boletoItem: BoletoItem = {
      id: initialData ? initialData.id : `bol-${Date.now()}`,
      linhaDigitavel: parsed.linhaDigitavelLimpa || linhaDigitavel.replace(/\D/g, ''),
      codigoBarras: parsed.codigoBarras || linhaDigitavel.replace(/\D/g, ''),
      bancoCodigo: bancoCodigo || parsed.bancoCodigo,
      bancoNome: bankInfo.shortName,
      favorecidoNome: favorecidoNome.toUpperCase() || 'FAVORECIDO NAO INFORMADO',
      favorecidoCnpjCpf: favorecidoCnpjCpf.replace(/\D/g, ''),
      valor: Number(valor) || 0,
      dataVencimento: dataVencimento,
      dataPagamento: dataPagamento || dataVencimento,
      seuNumero: seuNumero || `REF-${Date.now().toString().slice(-6)}`,
      desconto: Number(desconto) || 0,
      jurosMulta: Number(jurosMulta) || 0,
      categoria: categoria || 'Geral',
      observacoes: observacoes,
      tipoBoleto: tipoBoleto,
      placa: placa ? placa.toUpperCase().trim() : undefined,
      renavam: renavam ? renavam.trim() : undefined,
      autoInfracao: autoInfracao ? autoInfracao.toUpperCase().trim() : undefined,
      isValid: parsed.isValid || linhaDigitavel.replace(/\D/g, '').length >= 44,
      selected: true,
      createdAt: initialData ? initialData.createdAt : new Date().toISOString(),
    };

    onSave(boletoItem);
    onClose();
  };

  if (!isOpen) return null;

  const bankInfo = getBankInfo(bancoCodigo);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              {initialData ? 'Editar Boleto' : 'Novo Boleto Bancário'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Linha Digitável Input with Live Detection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Linha Digitável / Código de Barras
            </label>
            <textarea
              rows={2}
              value={linhaDigitavel}
              onChange={(e) => handleLinhaDigitavelChange(e.target.value)}
              placeholder="Cole aqui os 47 dígitos do boleto (ex: 00190.00009 01234.567004...)"
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono rounded-xl p-3 focus:outline-none focus:border-blue-600 focus:bg-white placeholder-slate-400 font-semibold"
              required
            />

            {/* Duplicate Alert Banner */}
            {duplicateInfo?.isDuplicate && (
              <div className="mt-2 bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl text-xs flex items-start space-x-2.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-amber-900">
                    ⚠️ Alerta: Boleto Repetido!
                  </p>
                  <p className="mt-0.5 text-amber-800 font-medium">
                    {duplicateInfo.duplicateReason || 'Este boleto (linha digitável/código de barras) já está cadastrado no sistema ou foi inserido no mesmo lote.'}
                  </p>
                </div>
              </div>
            )}

            {/* Parsing Banner Feedback */}
            {linhaDigitavel.trim().length > 0 && (
              <div className="mt-2">
                {parseStatus.isValid ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-extrabold text-emerald-900">Boleto Identificado!</span> Banco: {parseStatus.bancoNome} [{parseStatus.bancoCodigo}]
                      </div>
                    </div>
                    <span className="font-mono text-[11px] bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-emerald-900 font-bold">
                      {onlyNumbers(linhaDigitavel).length} dígitos OK
                    </span>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-medium">
                      {parseStatus.errorMessage || 'Verifique o número de dígitos (deve conter 47 dígitos para boletos bancários ou 48 dígitos para tributos/GNRE).'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Favorecido Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nome do Beneficiário / Favorecido
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={favorecidoNome}
                  onChange={(e) => setFavorecidoNome(e.target.value)}
                  placeholder="Ex: Fornecedor de Insumos LTDA"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                CPF ou CNPJ do Beneficiário
              </label>
              <input
                type="text"
                value={favorecidoCnpjCpf}
                onChange={(e) => setFavorecidoCnpjCpf(e.target.value)}
                placeholder="Ex: 12.345.678/0001-90"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
              />
            </div>
          </div>

          {/* Values and Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Valor Total a Recolher / Bruto (R$)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> Desconto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 text-emerald-800 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600 focus:bg-white font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" /> Juros / Multa (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={jurosMulta}
                onChange={(e) => setJurosMulta(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 text-amber-800 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-amber-600 focus:bg-white font-bold"
              />
            </div>
          </div>

          {/* Quick Adjustment Calculator Buttons */}
          {Number(valor) > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-bold text-[11px] mr-1">Atalhos de Ajuste:</span>
              <button
                type="button"
                onClick={() => setDesconto((Number(valor) * 0.05).toFixed(2))}
                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                -5% Desconto
              </button>
              <button
                type="button"
                onClick={() => setDesconto((Number(valor) * 0.10).toFixed(2))}
                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                -10% Desconto
              </button>
              <button
                type="button"
                onClick={() => setJurosMulta((Number(valor) * 0.02).toFixed(2))}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                +2% Multa
              </button>
              <button
                type="button"
                onClick={() => setJurosMulta((Number(valor) * 0.01).toFixed(2))}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                +1% Juros
              </button>
              {(Number(desconto) > 0 || Number(jurosMulta) > 0) && (
                <button
                  type="button"
                  onClick={() => { setDesconto(0); setJurosMulta(0); }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ml-auto cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          {/* Live Net Value Summary & Alert Box */}
          {(Number(desconto) > 0 || Number(jurosMulta) > 0) && (
            <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-2xl text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-slate-800">
                <span className="font-bold text-slate-600">Resumo do Valor Final:</span>
                <span className="font-mono text-sm font-black text-blue-900">
                  {formatCurrencyBRL(Number(valor) - Number(desconto) + Number(jurosMulta))}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-blue-200 text-[11px]">
                <span className="text-slate-600">Bruto: {formatCurrencyBRL(Number(valor))}</span>
                {Number(desconto) > 0 && (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-emerald-600" /> Desconto: -{formatCurrencyBRL(Number(desconto))}
                  </span>
                )}
                {Number(jurosMulta) > 0 && (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-amber-600" /> Juros/Multa: +{formatCurrencyBRL(Number(jurosMulta))}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Dates and Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => {
                  const newVenc = e.target.value;
                  setDataVencimento(newVenc);
                  const todayStr = new Date().toISOString().split('T')[0];
                  setDataPagamento((prev) => validateAndClampPaymentDate(prev, newVenc, todayStr));
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Data de Agendamento / Pgto
                </label>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setDataPagamento(validateAndClampPaymentDate(dataVencimento, dataVencimento, todayStr));
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                    title="Usar a mesma data de vencimento"
                  >
                    = Vencimento
                  </button>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      setDataPagamento(validateAndClampPaymentDate(todayStr, dataVencimento, todayStr));
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    Hoje
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={dataPagamento}
                min={new Date().toISOString().split('T')[0]}
                max={dataVencimento && dataVencimento >= new Date().toISOString().split('T')[0] ? dataVencimento : undefined}
                onChange={(e) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setDataPagamento(validateAndClampPaymentDate(e.target.value, dataVencimento, todayStr));
                }}
                className="w-full bg-slate-50 border border-slate-200 text-blue-900 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Seu Número / Ref. Nota
              </label>
              <input
                type="text"
                value={seuNumero}
                onChange={(e) => setSeuNumero(e.target.value)}
                placeholder="Ex: NF-1234"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                required
              />
            </div>
          </div>

          {/* Bank Selection & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Banco Emissor do Boleto
              </label>
              <select
                value={bancoCodigo}
                onChange={(e) => setBancoCodigo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
              >
                {Object.values(BRAZILIAN_BANKS).map((b) => (
                  <option key={b.code} value={b.code}>
                    [{b.code}] {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Categoria / Centro de Custo
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Licença, Insumos, Aluguel"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
              />
            </div>
          </div>

          {/* Observacoes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Observações Internas (Opcional)
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Pagamento referente ao contrato anual"
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {initialData ? 'Salvar Alterações' : 'Adicionar Boleto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
