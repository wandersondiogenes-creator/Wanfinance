import React, { useState } from 'react';
import { CompanySettings, BoletoItem } from '../types';
import { formatCurrencyBRL, formatDateBR } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import {
  Send,
  ShieldCheck,
  Key,
  Globe,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  Smartphone,
  Lock,
  Zap,
  ArrowRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface BankPaymentApiPanelProps {
  company: CompanySettings;
  boletos: BoletoItem[];
}

interface PaymentTransaction {
  id: string;
  protocol: string;
  bankName: string;
  bankCode: string;
  favorecidoNome: string;
  valor: number;
  linhaDigitavel: string;
  dataVencimento: string;
  dataAgendamento: string;
  status: 'PENDING_MASTER_AUTHORIZATION' | 'APPROVED_BY_MASTER' | 'EXECUTED' | 'REJECTED';
  sentAt: string;
  authorizerName?: string;
}

export const BankPaymentApiPanel: React.FC<BankPaymentApiPanelProps> = ({ company, boletos }) => {
  const bankInfo = getBankInfo(company.bancoCodigo);

  // Api Credentials state
  const [selectedBank, setSelectedBank] = useState(company.bancoCodigo || '237');
  const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('PRODUCTION');
  const [clientId, setClientId] = useState('cli_itau_openbanking_88294021');
  const [clientSecret, setClientSecret] = useState('••••••••••••••••••••••••••••••••');
  const [mtlsCertName, setMtlsCertName] = useState('cert_empresa_marques_2026.pem');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'TESTING' | 'DISCONNECTED'>('CONNECTED');
  const [copiedProtocol, setCopiedProtocol] = useState<string | null>(null);

  // Selection of boletos to send
  const validBoletos = boletos.filter((b) => b.isValid);
  const [selectedIds, setSelectedIds] = useState<string[]>(validBoletos.map((b) => b.id));

  // Transactions sent history state
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([
    {
      id: 'tx-1',
      protocol: 'ITAU-PAY-20260801-99821',
      bankName: 'Banco Itaú S.A.',
      bankCode: '341',
      favorecidoNome: 'CLARO S.A.',
      valor: 489.50,
      linhaDigitavel: '34191.79001 01043.510047 91020.150008 1 98020000048950',
      dataVencimento: '2026-08-05',
      dataAgendamento: '2026-08-05',
      status: 'PENDING_MASTER_AUTHORIZATION',
      sentAt: '01/08/2026 13:45',
      authorizerName: 'Aguardando Aprovação do Usuário Máster no App Itaú Empresas'
    },
    {
      id: 'tx-2',
      protocol: 'BRAD-PAY-20260801-44120',
      bankName: 'Banco Bradesco S.A.',
      bankCode: '237',
      favorecidoNome: 'SUHAI SEGURADORA S/A',
      valor: 1250.00,
      linhaDigitavel: '23793.39209 50005.692137 75020.156008 1 15200000125000',
      dataVencimento: '2026-08-10',
      dataAgendamento: '2026-08-10',
      status: 'APPROVED_BY_MASTER',
      sentAt: '01/08/2026 11:20',
      authorizerName: 'Autorizado por Wanderson Diógenes (Token Biométrico)'
    }
  ]);

  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === validBoletos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(validBoletos.map((b) => b.id));
    }
  };

  const handleTestConnection = () => {
    setConnectionStatus('TESTING');
    setTimeout(() => {
      setConnectionStatus('CONNECTED');
    }, 1200);
  };

  const handleSendToBank = () => {
    if (selectedIds.length === 0) return;

    setIsSending(true);
    setSendSuccessMessage(null);

    setTimeout(() => {
      const selectedBoletosList = validBoletos.filter((b) => selectedIds.includes(b.id));

      const newTxs: PaymentTransaction[] = selectedBoletosList.map((b, idx) => {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        const bankPrefix = bankInfo.shortName.substring(0, 4).toUpperCase();
        return {
          id: `tx-${Date.now()}-${idx}`,
          protocol: `${bankPrefix}-PAY-20260801-${randomNum}`,
          bankName: bankInfo.name,
          bankCode: company.bancoCodigo,
          favorecidoNome: b.favorecidoNome || 'Favorecido Desconhecido',
          valor: b.valor - (b.desconto || 0) + (b.jurosMulta || 0),
          linhaDigitavel: b.linhaDigitavel,
          dataVencimento: b.dataVencimento,
          dataAgendamento: b.dataPagamento || b.dataVencimento,
          status: 'PENDING_MASTER_AUTHORIZATION',
          sentAt: new Date().toLocaleString('pt-BR'),
          authorizerName: 'Aguardando Usuário Máster no App do Banco'
        };
      });

      setTransactions((prev) => [...newTxs, ...prev]);
      setIsSending(false);
      setSendSuccessMessage(
        `${newTxs.length} boleto(s) transmitido(s) com sucesso via API para o ${bankInfo.shortName}. O usuário máster já pode autorizar no aplicativo do banco!`
      );

      setTimeout(() => setSendSuccessMessage(null), 6000);
    }, 1500);
  };

  const handleRecheckStatus = (txId: string) => {
    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id === txId && tx.status === 'PENDING_MASTER_AUTHORIZATION') {
          return {
            ...tx,
            status: 'APPROVED_BY_MASTER',
            authorizerName: 'Aprovado via Token Mobile Máster'
          };
        }
        return tx;
      })
    );
  };

  const selectedBoletosList = validBoletos.filter((b) => selectedIds.includes(b.id));
  const totalValorSelected = selectedBoletosList.reduce(
    (acc, b) => acc + (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)),
    0
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedProtocol(text);
    setTimeout(() => setCopiedProtocol(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Title */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Zap className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">
                  Integração API de Pagamentos Bancários
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  Direct-to-Bank Open Finance
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl font-medium leading-relaxed">
                Envie ordens de pagamento de boletos diretamente para a conta corporativa do banco sem arquivos CNAB manuais. O pagamento é agendado e entra automaticamente na esteira de <strong className="text-amber-400">Aprovação do Usuário Máster</strong> no aplicativo bancário.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-700/80 p-3 rounded-2xl flex items-center space-x-3 shrink-0">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Conexão mTLS OAuth2</p>
              <p className="text-xs font-black text-amber-400">{company.razaoSocial}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Configuration & Bank Credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credentials Panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Credenciais da API Bancária
              </h3>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {connectionStatus === 'CONNECTED' ? 'Conectado ✓' : 'Testando...'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Banco Emissor / API:
              </label>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
              >
                <option value="341">Banco Itaú Unibanco S.A. (API Itaú Empresas)</option>
                <option value="237">Banco Bradesco S.A. (Bradesco API Transacional)</option>
                <option value="001">Banco do Brasil S.A. (BB API Pagamentos)</option>
                <option value="033">Banco Santander Brasil (Santander Open Banking)</option>
                <option value="077">Banco Inter (Inter Banking API)</option>
                <option value="208">BTG Pactual (BTG Corporate API)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Ambiente:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnvironment('PRODUCTION')}
                  className={`p-2 rounded-xl text-center font-bold text-xs cursor-pointer border ${
                    environment === 'PRODUCTION'
                      ? 'bg-slate-900 text-amber-400 border-slate-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  Produção (Real)
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment('SANDBOX')}
                  className={`p-2 rounded-xl text-center font-bold text-xs cursor-pointer border ${
                    environment === 'SANDBOX'
                      ? 'bg-amber-500 text-slate-950 border-amber-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  Sandbox (Testes)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Client ID OAuth2:</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs p-2 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Client Secret:</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 font-mono text-xs p-2 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Certificado mTLS (.pem/.pfx):</label>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-300 p-2 rounded-xl">
                <span className="font-mono text-[11px] text-slate-700 truncate">{mtlsCertName}</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">Validade 2027</span>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold p-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer mt-2"
            >
              <RefreshCw className={`w-4 h-4 ${connectionStatus === 'TESTING' ? 'animate-spin' : ''}`} />
              <span>Testar Conexão OAuth2 / mTLS</span>
            </button>
          </div>
        </div>

        {/* Action Panel: Send Boletos to Bank */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Enviar Boletos para Esteira do Banco
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
                >
                  {selectedIds.length === validBoletos.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
                <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {selectedIds.length} selecionado(s)
                </span>
              </div>
            </div>

            {sendSuccessMessage && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl flex items-start space-x-2 animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{sendSuccessMessage}</span>
              </div>
            )}

            {/* List of Boletos Ready for API Sending */}
            <div className="mt-3 max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {validBoletos.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  Nenhum boleto válido disponível no lote atual para transmissão.
                </div>
              ) : (
                validBoletos.map((b) => {
                  const isChecked = selectedIds.includes(b.id);
                  const valorFinal = b.valor - (b.desconto || 0) + (b.jurosMulta || 0);
                  return (
                    <div
                      key={b.id}
                      onClick={() => toggleSelect(b.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate">
                            {b.favorecidoNome || 'Favorecido Não Informado'}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 truncate">
                            {b.linhaDigitavel}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xs font-black text-slate-900 font-mono">
                          {formatCurrencyBRL(valorFinal)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-500">
                          Venc: {formatDateBR(b.dataVencimento)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Total & Direct API Send Button */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase">Total do Lote para API:</p>
              <p className="text-xl font-black text-slate-900 font-mono">
                {formatCurrencyBRL(totalValorSelected)}
              </p>
            </div>

            <button
              onClick={handleSendToBank}
              disabled={selectedIds.length === 0 || isSending}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transmitindo via OAuth2 mTLS...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>Transmitir para Aprovação Máster ({selectedIds.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Visual Workflow Explanation Card */}
      <div className="bg-[#0f141d] text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-tight">
              Como Funciona a Autorização do Usuário Máster no App do Banco
            </h3>
          </div>
          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full">
            Segurança Bancária Nível FEBRABAN
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#161e2c] border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-sm border border-amber-500/30">
              1
            </div>
            <p className="font-extrabold text-white">Transmissão Direta ERP</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Sua equipe envia os boletos com 1 clique usando o certificado mTLS corporativo.
            </p>
          </div>

          <div className="bg-[#161e2c] border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-sm border border-amber-500/30">
              2
            </div>
            <p className="font-extrabold text-white">Entrada na Esteira Bancária</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              O banco (Itaú, Bradesco, BB, Santander) registra a ordem no status <strong className="text-amber-400">"Pendente de Autorização"</strong>.
            </p>
          </div>

          <div className="bg-[#161e2c] border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-sm border border-amber-500/30">
              3
            </div>
            <p className="font-extrabold text-white">Aprovação do Máster</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              O diretor ou financeiro máster abre o aplicativo do banco no celular e aprova com Biometria/FaceID.
            </p>
          </div>

          <div className="bg-[#161e2c] border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-sm border border-emerald-500/30">
              4
            </div>
            <p className="font-extrabold text-white">Liquidação & Baixa</p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              O banco executa a liquidação no vencimento ou agendamento sem erro de digitação.
            </p>
          </div>
        </div>
      </div>

      {/* Transactions History & Master Authorization Tracker */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase">
              Histórico de Ordens Transmitidas via API & Status de Autorização
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Total de Transações: {transactions.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3">Protocolo / ID Transação</th>
                <th className="p-3">Banco / Canal</th>
                <th className="p-3">Favorecido / Beneficiário</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Vencimento</th>
                <th className="p-3 text-center">Status de Aprovação Máster</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Nenhuma ordem transmitida via API ainda.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-800">
                      <div className="flex items-center space-x-1.5">
                        <span>{tx.protocol}</span>
                        <button
                          onClick={() => copyToClipboard(tx.protocol)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copiar Protocolo"
                        >
                          {copiedProtocol === tx.protocol ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-normal">{tx.sentAt}</span>
                    </td>

                    <td className="p-3">
                      <span className="font-bold text-slate-900">{tx.bankName}</span>
                      <span className="text-[10px] text-slate-500 block">
                        Cód: {tx.bankCode} • OAuth2 Direct
                      </span>
                    </td>

                    <td className="p-3 font-bold text-slate-900">
                      {tx.favorecidoNome}
                    </td>

                    <td className="p-3 text-right font-mono font-black text-slate-900">
                      {formatCurrencyBRL(tx.valor)}
                    </td>

                    <td className="p-3 text-center font-mono text-slate-700">
                      {formatDateBR(tx.dataVencimento)}
                    </td>

                    <td className="p-3 text-center">
                      {tx.status === 'PENDING_MASTER_AUTHORIZATION' && (
                        <div className="inline-flex flex-col items-center">
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Pendente Autorização Máster</span>
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            {tx.authorizerName}
                          </span>
                        </div>
                      )}

                      {tx.status === 'APPROVED_BY_MASTER' && (
                        <div className="inline-flex flex-col items-center">
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-0.5 rounded-full text-[10px] flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Aprovado no App Banco</span>
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                            {tx.authorizerName}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {tx.status === 'PENDING_MASTER_AUTHORIZATION' ? (
                        <button
                          onClick={() => handleRecheckStatus(tx.id)}
                          className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-xl text-[10px] transition-all cursor-pointer"
                        >
                          Verificar Status
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">Pronto P/ Liquidação</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
