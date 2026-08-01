import React, { useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  KeyRound,
  AlertCircle,
  HelpCircle,
  Loader2,
  TrendingUp,
  Cpu,
  Database,
  X
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('financeiro@wanfinance.com.br');
  const [password, setPassword] = useState('wanfinance2026');
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

    if (!email.trim()) {
      setError('Por favor, informe seu e-mail de acesso.');
      return;
    }
    if (!password) {
      setError('Por favor, digite sua senha.');
      return;
    }

    setIsLoading(true);

    const supabase = getSupabaseClient();

    // Check Supabase authentication & user registration
    if (supabase) {
      try {
        // 1. Check Supabase Auth first
        const { data: authData } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (authData?.user) {
          const authUser: AuthUser = {
            id: authData.user.id,
            name: authData.user.user_metadata?.name || email.split('@')[0],
            email: authData.user.email || email.trim(),
            role: 'Administrador (Supabase Auth)',
            loginTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          };

          // Update login time in Supabase user_sessions
          await supabase.from('user_sessions').upsert({
            id: authUser.id,
            user_id: authUser.id,
            name: authUser.name,
            email: authUser.email,
            role: authUser.role,
            login_time: authUser.loginTime,
          });

          setIsLoading(false);
          onLoginSuccess(authUser);
          return;
        }

        // 2. Query user_sessions table in Supabase
        const { data: dbUser, error: dbError } = await supabase
          .from('user_sessions')
          .select('*')
          .ilike('email', email.trim())
          .maybeSingle();

        if (dbError) {
          if (dbError.code === '42P01') {
            setIsLoading(false);
            setError(
              'Acesso Negado: A tabela "user_sessions" não existe no Supabase. Execute o script SQL de migration.'
            );
            return;
          }
          console.warn('[Supabase Query Error]', dbError.message);
        }

        if (dbUser) {
          const registeredUser: AuthUser = {
            id: dbUser.user_id || dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role || 'Gestor Financeiro',
            loginTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          };

          // Update login time in Supabase
          await supabase.from('user_sessions').upsert({
            id: registeredUser.id,
            user_id: registeredUser.id,
            name: registeredUser.name,
            email: registeredUser.email,
            role: registeredUser.role,
            login_time: registeredUser.loginTime,
          });

          setIsLoading(false);
          onLoginSuccess(registeredUser);
          return;
        }

        // 3. User NOT registered in Supabase -> DENY ACCESS
        setIsLoading(false);
        setError('Acesso negado: Usuário não cadastrado no Supabase.');
        return;

      } catch (err: any) {
        setIsLoading(false);
        setError(`Acesso negado: ${err.message || String(err)}`);
        return;
      }
    } else {
      // Supabase not configured
      setIsLoading(false);
      setError('Acesso negado: Banco de dados Supabase não está configurado.');
      return;
    }
  };

  const handleQuickDemoLogin = async (roleName: string, demoEmail: string) => {
    setIsLoading(true);
    setError(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      setError('Acesso negado: Supabase não configurado.');
      return;
    }

    // Verify if demo email exists in Supabase
    try {
      const { data: dbUser } = await supabase
        .from('user_sessions')
        .select('*')
        .ilike('email', demoEmail.trim())
        .maybeSingle();

      if (!dbUser) {
        setIsLoading(false);
        setError(`Acesso negado: O usuário "${demoEmail}" não está cadastrado no Supabase.`);
        return;
      }

      const demoUser: AuthUser = {
        id: dbUser.user_id || dbUser.id,
        name: dbUser.name || roleName,
        email: dbUser.email,
        role: dbUser.role || 'Diretoria & CFO',
        loginTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      await supabase.from('user_sessions').upsert({
        id: demoUser.id,
        user_id: demoUser.id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        login_time: demoUser.loginTime,
      });

      setIsLoading(false);
      onLoginSuccess(demoUser);
    } catch (err: any) {
      setIsLoading(false);
      setError(`Acesso negado: ${err.message || String(err)}`);
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
    <div className="min-h-screen bg-slate-100 text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      {/* Decorative Background Lighting FX */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[160px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e130_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e130_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
      />

      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10">
        
        {/* Left Branding & Highlights Column */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-900 via-blue-950 to-indigo-950 p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Brand Logo & Name */}
          <div>
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-white text-blue-700 flex items-center justify-center shadow-lg font-black text-2xl">
                <FileSpreadsheet className="w-7 h-7 text-blue-700" />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-white block leading-none">
                  Wan<span className="text-blue-300">finance</span>
                </span>
                <span className="text-[11px] uppercase tracking-widest text-blue-200 font-bold mt-1 block">
                  Enterprise Financial Engine
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Gestão Financeira & Remessas Bancárias CNAB
              </h2>
              <p className="text-sm text-blue-100/90 leading-relaxed font-normal">
                Acesse a plataforma unificada para processamento de boletos, geração automatizada de arquivos CNAB 240/400 e extração inteligente por IA.
              </p>
            </div>

            {/* Feature Bullets */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-start space-x-3 text-xs text-blue-50">
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white font-semibold block">CNAB 240 / 400 Multi-banco</strong>
                  <span>Suporte completo para Itaú, Bradesco, Banco do Brasil, Santander, CEF e Inter.</span>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-xs text-blue-50">
                <div className="p-1 rounded-lg bg-blue-400/20 text-blue-200 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white font-semibold block">OCR IA Gemini 2.5</strong>
                  <span>Extração automática de faturas, boletos bancários, DARF e guias GNRE em PDF.</span>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-xs text-blue-50">
                <div className="p-1 rounded-lg bg-amber-400/20 text-amber-300 shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-white font-semibold block">Sincronização Google Sheets</strong>
                  <span>Exportação instantânea das remessas e atualização em tempo real na nuvem.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Security Badge */}
          <div className="mt-10 pt-6 border-t border-blue-800/80 flex items-center justify-between text-[11px] text-blue-200">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conexão Segura SSL 256-bit</span>
            </div>
            <span className="font-mono text-blue-300 font-bold">v3.4.0</span>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full">
            
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-200 inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Autenticação de Usuário</span>
                </span>
                {supabaseConnected && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>Supabase Integrado</span>
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Acesse sua conta
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {supabaseConnected
                  ? 'Acesse com seu usuário cadastrado no Supabase ou credencial corporativa'
                  : 'Insira suas credenciais corporativas Wanfinance para prosseguir'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-3 shadow-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                <div>
                  <strong className="block font-bold text-sm text-rose-900 mb-0.5">Acesso Negado</strong>
                  <span className="font-medium text-rose-700">{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.nome@wanfinance.com.br"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Senha de Acesso
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-11 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-blue-600/20 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                    Lembrar de mim neste dispositivo
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3.5 px-6 rounded-xl shadow-md shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 active:scale-[0.99] disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar na Plataforma</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Login Option */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Acesso Rápido Demonstrativo:
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('Wanderson Diógenes', 'wanderson@wanfinance.com.br')}
                  className="bg-slate-50 hover:bg-blue-50 text-slate-800 border border-slate-200 hover:border-blue-300 p-2.5 rounded-xl text-xs font-semibold text-left transition-all flex flex-col space-y-0.5 group cursor-pointer shadow-2xs"
                >
                  <span className="text-blue-700 font-bold group-hover:text-blue-800 transition-colors">
                    Wanderson Diógenes
                  </span>
                  <span className="text-[10px] text-slate-500">CEO & Diretoria Wanfinance</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('Equipe Financeira', 'financeiro@wanfinance.com.br')}
                  className="bg-slate-50 hover:bg-amber-50 text-slate-800 border border-slate-200 hover:border-amber-300 p-2.5 rounded-xl text-xs font-semibold text-left transition-all flex flex-col space-y-0.5 group cursor-pointer shadow-2xs"
                >
                  <span className="text-amber-700 font-bold group-hover:text-amber-800 transition-colors">
                    Gestor Financeiro
                  </span>
                  <span className="text-[10px] text-slate-500">Acesso Geral CNAB</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-800">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              Recuperação de Senha
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Digite seu e-mail corporativo cadastrado na Wanfinance para receber as instruções de redefinição de acesso.
            </p>

            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-bold">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="ex: voce@wanfinance.com.br"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
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
