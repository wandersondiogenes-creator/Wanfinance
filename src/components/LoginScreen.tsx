import React, { useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import executiveBg from '../assets/images/wanderson_background_1785604936294.jpg';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  FileText,
  AlertCircle,
  HelpCircle,
  Loader2,
  CheckCircle2
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
    <div className="min-h-screen text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans select-none bg-[#070a0f]">
      {/* Executive Photo Background - Subtle & Elegant */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-30 mix-blend-luminosity scale-105"
        style={{ backgroundImage: `url(${executiveBg})` }}
      />

      {/* Dark Executive Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#070a0f]/95 via-[#070a0f]/75 to-[#070a0f]/95" />
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-80" />

      {/* Ambient Glow Effects */}
      <div className="absolute -top-32 left-1/4 w-[650px] h-[650px] bg-amber-500/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-[700px] h-[700px] bg-amber-600/15 rounded-full blur-[180px] pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Central Content Container */}
      <div className="w-full max-w-5xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">
        
        {/* Left Branding Column */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Brand Header */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3.5">
              {/* Geometric Golden W Logo */}
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 border border-amber-300/40">
                <svg viewBox="0 0 100 100" className="w-8 h-8 text-slate-950 fill-current font-black">
                  <path d="M15 25 L35 75 L50 45 L65 75 L85 25 L70 25 L60 55 L50 35 L40 55 L30 25 Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white uppercase flex items-center gap-1">
                  WAN<span className="text-[#E5A93C]">FINANCE</span>
                </h1>
                <span className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-bold block">
                  INOVAÇÃO EM GESTÃO FINANCEIRA
                </span>
              </div>
            </div>
          </div>

          {/* Main Headline */}
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md">
              Gestão Financeira <br />
              <span className="text-slate-100">& Remessas Bancárias</span>
            </h2>
            {/* Amber accent bar */}
            <div className="w-16 h-1.5 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full shadow-md shadow-amber-500/30" />
          </div>

          {/* Feature Banner: CNAB 240 */}
          <div className="bg-[#121824]/90 border border-slate-700/60 rounded-2xl p-4.5 flex items-center space-x-4 max-w-lg backdrop-blur-md shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Geração de Arquivo</h4>
                <span className="text-xs font-black text-amber-400">.CNAB 240 / 400</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Processamento seguro de faturas, boletos e arquivos bancários.
              </p>
            </div>
          </div>
        </div>

        {/* Right Floating Card: Acesso ao Portal */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md bg-[#141a26]/95 border border-slate-700/80 rounded-3xl p-7 sm:p-9 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            
            {/* Top Lock Badge */}
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Lock className="w-5 h-5" />
            </div>

            {/* Portal Title */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Acesso ao Portal
              </h3>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User / Email Input */}
              <div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Usuário ou E-mail"
                    required
                    className="w-full bg-[#0d121c] border border-slate-700/80 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                    required
                    className="w-full bg-[#0d121c] border border-slate-700/80 rounded-xl py-3 pl-10 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0d121c] border-slate-700 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-slate-400 group-hover:text-slate-200 transition-colors">
                    Lembrar-me
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>

              {/* Entrar Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <span>Entrar</span>
                )}
              </button>
            </form>

          </div>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161d2b] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-slate-200">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Recuperação de Senha
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Digite seu e-mail corporativo cadastrado na Wanfinance para receber as instruções de redefinição de acesso.
            </p>

            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center font-bold">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="ex: voce@wanfinance.com.br"
                    required
                    className="w-full bg-[#0d121c] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer"
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

