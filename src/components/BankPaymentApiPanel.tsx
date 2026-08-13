import React, { useState, useEffect } from 'react';
import { CompanySettings, BoletoItem, BankPaymentApiConfig, BankApiTestResult, PaymentApiTransaction, BankApiLog } from '../types';
import { formatCurrencyBRL, formatDateBR } from '../utils/boletoParser';
import { getBankInfo, BRAZILIAN_BANKS } from '../utils/banks';
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
  Lock,
  Unlock,
  Zap,
  ArrowRight,
  Copy,
  Check,
  FileText,
  Server,
  Activity,
  Trash2,
  Code,
  ShieldAlert,
  Sliders,
  Layers
} from 'lucide-react';

interface BankPaymentApiPanelProps {
  company: CompanySettings;
  boletos: BoletoItem[];
}

// Default official bank API endpoints preset helper
const BANK_API_PRESETS: Record<string, { apiUrl: string; authUrl: string; scope: string }> = {
  '033': {
    apiUrl: 'https://api.santander.com.br/pagamentos/v1',
    authUrl: 'https://oauth.santander.com.br/oauth/token',
    scope: 'pagamentos.write pagamentos.read'
  },
  '341': {
    apiUrl: 'https://api.itau.com.br/open-banking/pagamentos/v1',
    authUrl: 'https://sts.itau.com.br/api/oauth/token',
    scope: 'pagamentos.v1.write'
  },
  '237': {
    apiUrl: 'https://api.bradesco.com.br/v1/pagamentos',
    authUrl: 'https://auth.bradesco.com.br/oauth2/token',
    scope: 'pagamentos'
  },
  '001': {
    apiUrl: 'https://api.bb.com.br/pagamentos-lote/v1',
    authUrl: 'https://oauth.bb.com.br/oauth/token',
    scope: 'pagamentos-correntistas.write'
  },
  '104': {
    apiUrl: 'https://api.caixa.gov.br/pagamentos/v1',
    authUrl: 'https://api.caixa.gov.br/oauth2/v1/token',
    scope: 'pagamentos.convenio'
  },
  '422': {
    apiUrl: 'https://api.safra.com.br/open-banking/pagamentos/v1',
    authUrl: 'https://auth.safra.com.br/oauth2/token',
    scope: 'payments.write'
  },
  '077': {
    apiUrl: 'https://cdpj.banking.bancointer.com.br/pagamentos/v2',
    authUrl: 'https://cdpj.banking.bancointer.com.br/oauth/v2/token',
    scope: 'boleto-cobranca.read boleto-cobranca.write'
  }
};

export const BankPaymentApiPanel: React.FC<BankPaymentApiPanelProps> = ({ company, boletos }) => {
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'SEND' | 'STATUS' | 'LOGS'>('CONFIG');

  // Form State initialized cleanly without mock credentials
  const [bancoCodigo, setBancoCodigo] = useState(company.bancoCodigo || '237');
  const [bancoNome, setBancoNome] = useState(company.bancoNome || 'Banco Bradesco S.A.');
  const [ambiente, setAmbiente] = useState<'SANDBOX' | 'PRODUCTION'>('PRODUCTION');
  const [apiUrl, setApiUrl] = useState(BANK_API_PRESETS[company.bancoCodigo]?.apiUrl || 'https://api.bradesco.com.br/v1/pagamentos');
  const [authUrl, setAuthUrl] = useState(BANK_API_PRESETS[company.bancoCodigo]?.authUrl || 'https://auth.bradesco.com.br/oauth2/token');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [certificadoPem, setCertificadoPem] = useState('');
  const [certificadoName, setCertificadoName] = useState('');
  const [senhaCertificado, setSenhaCertificado] = useState('');
  const [oauthFlow, setOauthFlow] = useState<'CLIENT_CREDENTIALS' | 'MUTUAL_TLS_OAUTH'>('CLIENT_CREDENTIALS');
  const [scope, setScope] = useState(BANK_API_PRESETS[company.bancoCodigo]?.scope || 'pagamentos');
  const [convenio, setConvenio] = useState(company.convenio || '');
  const [conta, setConta] = useState(company.conta ? `${company.conta}-${company.contaDV}` : '');
  const [agencia, setAgencia] = useState(company.agencia || '');
  const [empresaId, setEmpresaId] = useState(company.cnpjCpf || '');

  // Validation & Test state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [missingFieldKeys, setMissingFieldKeys] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<BankApiTestResult | null>(null);
  const [isConnectionValidated, setIsConnectionValidated] = useState(false);
  const [configSavedSuccess, setConfigSavedSuccess] = useState<string | null>(null);

  // Payments & Transactions state
  const validBoletos = boletos.filter((b) => b.isValid);
  const [selectedIds, setSelectedIds] = useState<string[]>(validBoletos.map((b) => b.id));
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentApiTransaction[]>([]);
  const [logs, setLogs] = useState<BankApiLog[]>([]);

  // Selected transaction for query/cancel
  const [queryProtocolInput, setQueryProtocolInput] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState<string | null>(null);

  // Update presets when bank selection changes
  const handleBankChange = (code: string) => {
    setBancoCodigo(code);
    const info = getBankInfo(code);
    setBancoNome(info.name);
    if (BANK_API_PRESETS[code]) {
      setApiUrl(BANK_API_PRESETS[code].apiUrl);
      setAuthUrl(BANK_API_PRESETS[code].authUrl);
      setScope(BANK_API_PRESETS[code].scope);
    }
  };

  // Helper to validate all required fields
  const checkMandatoryFields = () => {
    const missing: string[] = [];
    if (!bancoNome.trim()) missing.push('bancoNome');
    if (!ambiente) missing.push('ambiente');
    if (!apiUrl.trim()) missing.push('apiUrl');
    if (!authUrl.trim()) missing.push('authUrl');
    if (!clientId.trim()) missing.push('clientId');
    if (!clientSecret.trim()) missing.push('clientSecret');
    if (!scope.trim()) missing.push('scope');
    if (!convenio.trim()) missing.push('convenio');
    if (!conta.trim()) missing.push('conta');
    if (!agencia.trim()) missing.push('agencia');
    if (!empresaId.trim()) missing.push('empresaId');

    setMissingFieldKeys(missing);
    return missing;
  };

  // File Upload handler for Certificate (.pem or .pfx)
  const handleCertFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCertificadoName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCertificadoPem(content);
    };
    reader.readAsText(file);
  };

  // Test Connection Action
  const handleTestConnection = async () => {
    setValidationError(null);
    setConfigSavedSuccess(null);

    const missing = checkMandatoryFields();
    if (missing.length > 0) {
      setValidationError('Não é possível testar a conexão: preencha todos os campos obrigatórios em destaque.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const configPayload = {
      bancoCodigo,
      bancoNome,
      ambiente,
      apiUrl,
      authUrl,
      clientId,
      clientSecret,
      certificadoPem,
      senhaCertificado,
      oauthFlow,
      scope,
      convenio,
      conta,
      agencia,
      empresaId
    };

    try {
      const response = await fetch('/api/bank-payment/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload)
      });

      const resData = await response.json();
      setTestResult(resData);
      setIsTesting(false);

      if (resData.success) {
        setIsConnectionValidated(true);
        setConfigSavedSuccess('Conexão testada e validada com sucesso! As funcionalidades de pagamento via API foram liberadas.');
      } else {
        setIsConnectionValidated(false);
        setValidationError(`Falha no teste de conexão com o banco: ${resData.errorReason || resData.apiMessage}`);
      }

      // Fetch updated logs
      fetchLogs();
    } catch (err: any) {
      setIsTesting(false);
      setIsConnectionValidated(false);
      const errReason = 'Não foi possível conectar ao servidor backend para realizar o teste de API.';
      setValidationError(errReason);
      setTestResult({
        httpStatus: 0,
        responseTimeMs: 0,
        apiMessage: errReason,
        errorReason: errReason,
        rawJson: JSON.stringify({ error: String(err) }, null, 2),
        timestamp: new Date().toLocaleString('pt-BR'),
        success: false
      });
    }
  };

  // Save Configuration Action
  const handleSaveConfig = () => {
    setValidationError(null);
    setConfigSavedSuccess(null);

    const missing = checkMandatoryFields();
    if (missing.length > 0) {
      setValidationError('Nenhum dado foi salvo. Preencha obrigatoriamente todos os campos abaixo para salvar a integração.');
      return;
    }

    if (!isConnectionValidated) {
      setValidationError('Clique primeiro no botão "Testar Conexão Real" para autenticar e validar o acesso antes de salvar.');
      return;
    }

    setConfigSavedSuccess('Configurações da API de Pagamentos salvas com sucesso no ambiente seguro!');
  };

  // Transmit Payments Action
  const handleSendPayments = async () => {
    if (!isConnectionValidated) {
      setValidationError('A conexão com a API precisa estar previamente testada e validada para enviar pagamentos.');
      return;
    }

    if (selectedIds.length === 0) return;

    setIsSending(true);
    setSendSuccessMessage(null);

    const selectedBoletosList = validBoletos.filter((b) => selectedIds.includes(b.id));

    const payload = {
      config: {
        bancoCodigo,
        bancoNome,
        ambiente,
        apiUrl,
        convenio,
        agencia,
        conta,
        empresaId,
        isConnectionValidated
      },
      boletos: selectedBoletosList
    };

    try {
      const response = await fetch('/api/bank-payment/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      setIsSending(false);

      if (resData.success && Array.isArray(resData.transactions)) {
        setTransactions((prev) => [...resData.transactions, ...prev]);
        setSendSuccessMessage(resData.message);
        setTimeout(() => setSendSuccessMessage(null), 6000);
        fetchLogs();
      } else {
        alert(`Erro ao transmitir pagamentos: ${resData.message || 'Falha no servidor.'}`);
      }
    } catch (err: any) {
      setIsSending(false);
      alert(`Erro na requisição de envio de pagamentos: ${String(err?.message || err)}`);
    }
  };

  // Query status action
  const handleQueryStatus = async (protocolo: string) => {
    setActionMessage(null);
    try {
      const res = await fetch('/api/bank-payment/query-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo, config: { bancoNome, apiUrl } })
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        setTransactions((prev) => prev.map((t) => (t.protocolo === protocolo ? data.transaction : t)));
        setActionMessage(`Status do protocolo ${protocolo} atualizado para: ${data.transaction.status} (${data.transaction.mensagemRetorno})`);
        fetchLogs();
      } else {
        setActionMessage(`Erro ao consultar protocolo: ${data.message}`);
      }
    } catch (err) {
      setActionMessage('Erro de conexão ao consultar protocolo.');
    }
  };

  // Cancel Payment action
  const handleCancelPayment = async (protocolo: string) => {
    if (!confirm(`Tem certeza que deseja solicitar o cancelamento do pagamento de protocolo ${protocolo}?`)) return;

    setActionMessage(null);
    try {
      const res = await fetch('/api/bank-payment/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo, config: { bancoNome, apiUrl } })
      });
      const data = await res.json();
      if (data.success && data.transaction) {
        setTransactions((prev) => prev.map((t) => (t.protocolo === protocolo ? data.transaction : t)));
        setActionMessage(`Pagamento de protocolo ${protocolo} CANCELADO com sucesso na API do banco!`);
        fetchLogs();
      } else {
        setActionMessage(`Erro ao cancelar pagamento: ${data.message}`);
      }
    } catch (err) {
      setActionMessage('Erro de conexão ao solicitar cancelamento.');
    }
  };

  // Fetch Logs from Backend
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/bank-payment/logs');
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.logs)) setLogs(data.logs);
        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          setTransactions(data.transactions);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === validBoletos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(validBoletos.map((b) => b.id));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedProtocol(text);
    setTimeout(() => setCopiedProtocol(null), 2000);
  };

  const selectedBoletosList = validBoletos.filter((b) => selectedIds.includes(b.id));
  const totalValorSelected = selectedBoletosList.reduce((acc, b) => acc + (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 border border-slate-700/60 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
              <Zap className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black uppercase tracking-tight text-white">
                  Módulo Oficial de Integração API de Pagamentos
                </h2>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                  Conexão Direta Sem Mocks
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-1 max-w-2xl">
                Autenticação OAuth2 / mTLS e transmissão HTTPS de pagamentos diretamente para as APIs oficiais do Santander, Itaú, Bradesco, Banco do Brasil, Caixa, Safra e Inter.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-700/80 shrink-0">
            {isConnectionValidated ? (
              <>
                <Unlock className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Status da API</p>
                  <p className="text-xs font-black text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    CONEXÃO VALIDADA
                  </p>
                </div>
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Status da API</p>
                  <p className="text-xs font-black text-amber-400">AGUARDANDO TESTE</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-700/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'CONFIG'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>1. Configuração da API</span>
          </button>

          <button
            onClick={() => setActiveTab('SEND')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SEND'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isConnectionValidated ? <Send className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>2. Envio de Pagamentos</span>
          </button>

          <button
            onClick={() => setActiveTab('STATUS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'STATUS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isConnectionValidated ? <Activity className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-400" />}
            <span>3. Consulta & Cancelamento</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>4. Logs de Transmissão</span>
            {logs.length > 0 && (
              <span className="bg-slate-900 text-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {logs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {validationError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs uppercase tracking-wider text-rose-700">Aviso de Validação / Conexão</p>
            <p className="text-xs text-rose-800 font-medium mt-0.5">{validationError}</p>
          </div>
        </div>
      )}

      {configSavedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs uppercase tracking-wider text-emerald-700">Status da Integração</p>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">{configSavedSuccess}</p>
          </div>
        </div>
      )}

      {/* TAB 1: API CONFIGURATION FORM */}
      {activeTab === 'CONFIG' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Parâmetros de Conexão com API Oficial</h3>
                <p className="text-slate-500 text-xs">Todos os campos marcados com (*) são obrigatórios para a conexão funcionar com segurança.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Ambiente:</span>
              <button
                type="button"
                onClick={() => setAmbiente('SANDBOX')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  ambiente === 'SANDBOX' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => setAmbiente('PRODUCTION')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  ambiente === 'PRODUCTION' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Produção
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Nome do Banco */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                1. Nome do Banco <span className="text-rose-500">*</span>
              </label>
              <select
                value={bancoCodigo}
                onChange={(e) => handleBankChange(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('bancoNome') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              >
                {Object.values(BRAZILIAN_BANKS).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Convênio / Código Beneficiário */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                2. Convênio / Código Beneficiário <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 003829102 ou 1234567"
                value={convenio}
                onChange={(e) => setConvenio(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('convenio') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 3. CNPJ da Empresa / Identificador */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                3. Identificador / CNPJ da Empresa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('empresaId') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 4. Agência */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                4. Agência Bancária <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 3392"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('agencia') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 5. Conta */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                5. Conta Bancária com DV <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 0201560-9"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('conta') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 6. URL do Servidor OAuth2 / Token */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                6. URL do Servidor OAuth2 / Token <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="https://oauth.banco.com.br/oauth2/token"
                value={authUrl}
                onChange={(e) => setAuthUrl(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-mono font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('authUrl') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 7. URL da API de Pagamentos */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                7. URL da API de Pagamentos <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="https://api.banco.com.br/v1/pagamentos"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-mono font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('apiUrl') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 8. Client ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                8. Client ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Cole o Client ID fornecido pelo banco"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-mono font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('clientId') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 9. Client Secret */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                9. Client Secret <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Cole o Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-mono font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('clientSecret') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 10. Scope da API */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                10. Scope / Escopo da API <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: pagamentos.write pagamentos.read"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className={`w-full bg-slate-50 border text-slate-900 text-xs font-mono font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 ${
                  missingFieldKeys.includes('scope') ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 11. OAuth2 Grant Type / Flow */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                11. Fluxo de Autenticação OAuth2
              </label>
              <select
                value={oauthFlow}
                onChange={(e) => setOauthFlow(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500"
              >
                <option value="CLIENT_CREDENTIALS">Client Credentials (Padrão Open Banking)</option>
                <option value="MUTUAL_TLS_OAUTH">Mutual TLS (mTLS) + Client Credentials</option>
              </select>
            </div>

            {/* 12. Certificado Digital */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                12. Certificado Digital A1/A3 (.PEM / .PFX)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pem,.pfx,.crt,.key"
                  onChange={handleCertFileUpload}
                  className="hidden"
                  id="cert-file-input"
                />
                <label
                  htmlFor="cert-file-input"
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{certificadoName ? 'Alterar' : 'Selecionar Arquivo'}</span>
                </label>
                <span className="text-xs text-slate-600 truncate font-mono">
                  {certificadoName || 'Nenhum certificado carregado'}
                </span>
              </div>
            </div>

            {/* 13. Senha do Certificado */}
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                13. Senha do Certificado Digital
              </label>
              <input
                type="password"
                placeholder="Senha de proteção do arquivo do certificado"
                value={senhaCertificado}
                onChange={(e) => setSenhaCertificado(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-semibold px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Action Buttons: Test Connection & Save */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              <p className="font-semibold text-slate-700">🔒 Segurança de Dados:</p>
              <p className="text-[11px]">As credenciais são enviadas via canal criptografado HTTPS diretamente aos servidores de auth do banco.</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold text-xs px-5 py-3 rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer border border-amber-500/30 disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Autenticando na API do Banco...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Testar Conexão Real</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-6 py-3 rounded-2xl transition-all shadow-md cursor-pointer"
              >
                Salvar Configuração
              </button>
            </div>
          </div>

          {/* Real Live Connection Test Result Display Box */}
          {testResult && (
            <div className={`mt-6 rounded-2xl border p-5 space-y-4 ${
              testResult.success ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <div className="flex items-center space-x-2">
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <h4 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                    Resultado do Teste de Conexão Real - {bancoNome}
                  </h4>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                    testResult.httpStatus >= 200 && testResult.httpStatus < 300
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                      : 'bg-rose-100 text-rose-800 border-rose-400'
                  }`}>
                    HTTP {testResult.httpStatus || 0}
                  </span>

                  <span className="text-xs font-mono text-slate-600 font-bold bg-white px-2.5 py-1 rounded-full border border-slate-200">
                    ⏱️ {testResult.responseTimeMs} ms
                  </span>

                  <span className="text-[11px] text-slate-500 font-semibold">
                    {testResult.timestamp}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-bold text-slate-700">Mensagem da API do Banco:</p>
                  <p className="text-slate-800 font-medium bg-white/80 p-2.5 rounded-xl border border-slate-200/80 mt-1">
                    {testResult.apiMessage}
                  </p>
                </div>

                {testResult.tokenObtido && (
                  <div>
                    <p className="font-bold text-slate-700">Token OAuth2 de Acesso Obtido:</p>
                    <p className="text-emerald-900 font-mono text-[11px] bg-emerald-100/80 p-2.5 rounded-xl border border-emerald-300 mt-1 truncate font-semibold">
                      🔑 {testResult.tokenObtido}
                    </p>
                  </div>
                )}

                {testResult.errorReason && !testResult.success && (
                  <div className="md:col-span-2">
                    <p className="font-bold text-rose-800">Diagnóstico / Motivo do Erro:</p>
                    <p className="text-rose-900 font-semibold bg-rose-100/90 p-2.5 rounded-xl border border-rose-300 mt-1">
                      ⚠️ {testResult.errorReason}
                    </p>
                  </div>
                )}
              </div>

              {/* Raw JSON Breakdown */}
              <div>
                <p className="font-bold text-slate-700 text-xs mb-1">JSON Completo de Resposta do Servidor do Banco:</p>
                <pre className="bg-slate-900 text-amber-300 font-mono text-[11px] p-3 rounded-xl overflow-x-auto max-h-48 border border-slate-800 leading-tight">
                  {testResult.rawJson}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT TRANSMISSION (LOCKED UNLESS VALIDATED) */}
      {activeTab === 'SEND' && (
        <div className="space-y-6">
          {!isConnectionValidated ? (
            <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-3xl p-8 text-center space-y-4">
              <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-2xl mx-auto flex items-center justify-center">
                <Lock className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-extrabold text-slate-900 text-lg">Funcionalidade de Envios Bloqueada</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Por norma de segurança bancária, o envio direto de pagamentos via API só é liberado após um teste de conexão real autenticado com sucesso.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('CONFIG')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Ir para Tela de Configuração e Testar Conexão
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Transmissão Direta de Boletos via API</h3>
                  <p className="text-slate-500 text-xs">
                    Selecione os boletos validados abaixo e transmita a instrução de pagamento para a API do {bancoNome}.
                  </p>
                </div>

                <div className="flex items-center space-x-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Total Selecionado</p>
                    <p className="text-sm font-black text-amber-600">{formatCurrencyBRL(totalValorSelected)}</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                    {selectedIds.length} boleto(s)
                  </span>
                </div>
              </div>

              {sendSuccessMessage && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-xs font-bold">{sendSuccessMessage}</p>
                </div>
              )}

              {validBoletos.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
                  Nenhum boleto válido carregado no sistema para envio via API.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                    >
                      {selectedIds.length === validBoletos.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                    <span className="text-xs text-slate-500">
                      Mostrando {validBoletos.length} boleto(s) pronto(s) para transmissão
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === validBoletos.length && validBoletos.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded-md border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </th>
                          <th className="p-3">Favorecido / Beneficiário</th>
                          <th className="p-3">Linha Digitável / Documento</th>
                          <th className="p-3">Vencimento</th>
                          <th className="p-3 text-right">Valor Líquido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validBoletos.map((b) => {
                          const isSel = selectedIds.includes(b.id);
                          const valorLiq = b.valor - (b.desconto || 0) + (b.jurosMulta || 0);
                          return (
                            <tr
                              key={b.id}
                              onClick={() => toggleSelect(b.id)}
                              className={`cursor-pointer transition-all ${
                                isSel ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleSelect(b.id)}
                                  className="rounded-md border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-extrabold text-slate-900">
                                {b.favorecidoNome || 'Favorecido Não Identificado'}
                                {b.favorecidoCnpjCpf && (
                                  <span className="block text-[10px] font-normal text-slate-500 font-mono">
                                    {b.favorecidoCnpjCpf}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-700">
                                <span className="block font-semibold">{b.linhaDigitavel}</span>
                                <span className="text-[10px] text-slate-400">Doc: {b.seuNumero || 'N/A'}</span>
                              </td>
                              <td className="p-3 font-semibold text-slate-800">
                                {formatDateBR(b.dataVencimento)}
                              </td>
                              <td className="p-3 text-right font-black text-slate-900">
                                {formatCurrencyBRL(valorLiq)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSendPayments}
                      disabled={isSending || selectedIds.length === 0}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-8 py-3.5 rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Transmitindo para API do Banco...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-slate-950" />
                          <span>Transmitir {selectedIds.length} Pagamento(s) Agendado(s)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUERY & CANCELLATION */}
      {activeTab === 'STATUS' && (
        <div className="space-y-6">
          {!isConnectionValidated ? (
            <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-3xl p-8 text-center space-y-4">
              <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-2xl mx-auto flex items-center justify-center">
                <Lock className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-extrabold text-slate-900 text-lg">Consulta & Cancelamento Bloqueados</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Valide a conexão com a API do banco primeiro para realizar consultas em tempo real.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Gerenciamento de Remessas Transmitidas</h3>
                <p className="text-slate-500 text-xs">
                  Consulte o status em tempo real das remessas no banco ou solicite o cancelamento de agendamentos pendentes.
                </p>
              </div>

              {actionMessage && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{actionMessage}</span>
                </div>
              )}

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
                  Nenhuma transmissão realizada até o momento. Transmita pagamentos na Aba 2 para acompanhar o histórico aqui.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Protocolo do Banco</th>
                        <th className="p-3">Favorecido</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3">Vencimento</th>
                        <th className="p-3">Status na API</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{tx.protocolo}</span>
                              <button
                                onClick={() => copyToClipboard(tx.protocolo)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Copiar Protocolo"
                              >
                                {copiedProtocol === tx.protocolo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <span className="text-[10px] font-normal text-slate-400 block">{tx.dataEnvio}</span>
                          </td>
                          <td className="p-3 font-extrabold text-slate-800">
                            {tx.favorecidoNome}
                          </td>
                          <td className="p-3 font-black text-slate-900">
                            {formatCurrencyBRL(tx.valor)}
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            {formatDateBR(tx.dataVencimento)}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              tx.status === 'EFETIVADO'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : tx.status === 'CANCELADO'
                                ? 'bg-slate-100 text-slate-600 border border-slate-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleQueryStatus(tx.protocolo)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                title="Consultar status atualizado no banco"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Consultar</span>
                              </button>

                              {tx.canCancel && (
                                <button
                                  onClick={() => handleCancelPayment(tx.protocolo)}
                                  className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[11px] px-2.5 py-1 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                  title="Cancelar agendamento de pagamento no banco"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Cancelar</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DETAILED LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Logs de Transmissão HTTPS com a API do Banco</h3>
              <p className="text-slate-500 text-xs">
                Auditoria técnica completa das requisições, status HTTP, tempos de resposta e respostas JSON.
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar Logs</span>
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
              Nenhum log de transmissão gravado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-xs space-y-2 border border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        log.method === 'POST' ? 'bg-blue-900 text-blue-200' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {log.method}
                      </span>
                      <span className="font-bold text-amber-300">{log.endpoint}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.httpStatus >= 200 && log.httpStatus < 300
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        HTTP {log.httpStatus}
                      </span>
                      <span className="text-slate-400 text-[11px]">{log.responseTimeMs} ms</span>
                      <span className="text-slate-500 text-[11px]">{log.timestamp}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-slate-500 font-bold text-[10px] uppercase block">Request Body:</span>
                      <pre className="text-slate-300 text-[10px] bg-slate-950 p-2 rounded-lg overflow-x-auto max-h-28">
                        {log.requestPayload}
                      </pre>
                    </div>

                    <div>
                      <span className="text-slate-500 font-bold text-[10px] uppercase block">Response JSON:</span>
                      <pre className="text-amber-200 text-[10px] bg-slate-950 p-2 rounded-lg overflow-x-auto max-h-28">
                        {log.responsePayload}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
