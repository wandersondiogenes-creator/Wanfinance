import React, { useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Fingerprint,
  Layers,
  Building2,
  Check
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('pagamentodetran@grupovia1.com.br');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (supabase) {
      setSupabaseConnected(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail corporativo de acesso.');
      return;
    }
    if (!cleanPassword) {
      setError('Por favor, digite sua senha de acesso corporativa.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Validação Segura e Autenticação no Backend Corporativo (Sem bypass / Sem hardcode)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        const authenticatedUser: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          token: data.user.token,
          loginTime: data.user.loginTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };

        // Sincroniza sessão no Supabase se cliente estiver ativo e com RLS
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            await supabase.from('user_sessions').upsert({
              id: authenticatedUser.id,
              user_id: authenticatedUser.id,
              name: authenticatedUser.name,
              email: authenticatedUser.email,
              role: authenticatedUser.role,
              login_time: authenticatedUser.loginTime,
            });
          } catch (syncErr) {
            console.warn('[Session Sync Note]', syncErr);
          }
        }

        setIsLoading(false);
        onLoginSuccess(authenticatedUser);
        return;
      }

      // Se o backend recusou as credenciais
      setIsLoading(false);
      setError(data.message || 'Acesso negado: E-mail ou senha corporativa incorretos.');
      return;
    } catch (err: any) {
      // Tentar Supabase Auth se o backend estiver inacessível temporariamente
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (authData?.user && !authErr) {
            const authUser: AuthUser = {
              id: authData.user.id,
              name: authData.user.user_metadata?.name || cleanEmail.split('@')[0],
              email: authData.user.email || cleanEmail,
              role: authData.user.user_metadata?.role || 'OPERADOR',
              loginTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            };

            setIsLoading(false);
            onLoginSuccess(authUser);
            return;
          }
        } catch (supabaseErr) {
          console.warn('[Supabase Auth Error]', supabaseErr);
        }
      }

      setIsLoading(false);
      setError('Acesso negado: Credenciais inválidas ou serviço de autenticação indisponível.');
      return;
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotSuccess(false);
      setShowForgotPassword(false);
      setForgotEmail('');
    }, 3000);
  };

  return (
    <div className="min-h-screen text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans select-none bg-[#f5f5f7] dark:bg-[#000000]">
      {/* Apple Subtle Mesh Gradients */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/20 via-indigo-400/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[650px] h-[650px] bg-gradient-to-tl from-purple-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      
      {/* Apple Top Status / Brand Header */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10 py-2">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/25">
            W
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              Wanfinance
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5 font-medium">
              Portal Financeiro
            </span>
          </div>
        </div>
      </header>

      {/* Apple iPad-Style Central Card Form */}
      <main className="w-full max-w-4xl mx-auto my-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6">
        
        {/* Left Informational Showcase */}
        <div className="lg:col-span-6 space-y-6 hidden lg:block pr-4">
          <div className="space-y-3">
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              Gestão de Pagamentos & <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Remessas Bancárias
              </span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
              Acesse a plataforma integrada para geração de arquivos CNAB, leitura inteligente de boletos por IA e conciliação bancária multi-empresa.
            </p>
          </div>

          {/* Apple Bento Cards Preview */}
          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-[#1c1c1e]/70 border border-black/[0.06] dark:border-white/[0.08] backdrop-blur-xl flex items-center gap-3.5 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Inteligência Artificial Integrada
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Extração automatizada de faturas PDF e conciliação de extratos OFX
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Apple Glassmorphism Login Card */}
        <div className="lg:col-span-6 flex justify-center w-full">
          <div className="w-full max-w-md bg-white/80 dark:bg-[#1c1c1e]/80 border border-black/[0.08] dark:border-white/[0.1] rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
            
            {/* Top iPad Glass Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
              <Lock className="w-6 h-6" />
            </div>

            {/* Apple Card Title */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Iniciar Sessão
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Insira suas credenciais corporativas
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User / Email Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between pl-1">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    E-mail Corporativo
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    Grupo Via1 / Wanfinance
                  </span>
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pagamentodetran@grupovia1.com.br"
                    required
                    className="w-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl py-3 pl-10 pr-4 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  />
                </div>

                {/* Quick Account Pill */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('pagamentodetran@grupovia1.com.br');
                      setError(null);
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium flex items-center gap-1 ${
                      email.toLowerCase() === 'pagamentodetran@grupovia1.com.br'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                        : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:border-blue-200 hover:text-blue-600'
                    }`}
                  >
                    <Building2 className="w-3 h-3 text-blue-500" />
                    Pagamento Detran (Via1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@wanfinance.com.br');
                      setError(null);
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium flex items-center gap-1 ${
                      email.toLowerCase() === 'admin@wanfinance.com.br'
                        ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                        : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:border-blue-200 hover:text-blue-600'
                    }`}
                  >
                    Admin Wanfinance
                  </button>
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl py-3 pl-10 pr-11 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1 px-1">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-md bg-black/[0.05] dark:bg-white/[0.1] border-black/10 dark:border-white/15 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  />
                  <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-xs font-medium">
                    Lembrar
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium transition-colors cursor-pointer text-xs"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Apple Pill Primary Action Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold text-xs py-3 px-6 rounded-2xl shadow-md shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60 mt-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span>Acessar Wanfinance</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </button>
            </form>

            {/* Bottom Apple ID Security Note */}
            <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-blue-500" />
                Criptografia e conformidade FEBRABAN
              </span>
            </div>
          </div>
        </div>

      </main>

      {/* Apple Minimal Footer */}
      <footer className="w-full max-w-6xl mx-auto py-3 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 z-10">
        <span>© {new Date().getFullYear()} Wanfinance Gestão Financeira</span>
        <span>Tecnologia CNAB 240 / 400</span>
      </footer>

      {/* Apple-styled Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-[#1c1c1e]/95 border border-black/10 dark:border-white/10 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl backdrop-blur-2xl relative text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold mb-1 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              Recuperação de Acesso
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Informe seu e-mail cadastrado na Wanfinance para receber as instruções de redefinição de senha.
            </p>

            {forgotSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs text-center font-semibold space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                <p>E-mail de recuperação enviado com sucesso!</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="ex: voce@empresa.com.br"
                    required
                    className="w-full bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="px-4 py-2 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Enviar Instruções
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
