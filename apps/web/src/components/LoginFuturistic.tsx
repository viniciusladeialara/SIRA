import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import {
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";

export function LoginFuturistic() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pointer, setPointer] = useState({ x: 50, y: 50 });

  const { toast } = useToast();
  const { isAutoLogout, setAutoLogout, authError, setAuthError } = useAuth();

  useEffect(() => {
    if (authError) {
      toast({
        title: "Acesso Negado",
        description: authError,
        variant: "destructive",
      });
      setAuthError(null);
    }
  }, [authError, setAuthError, toast]);

  useEffect(() => {
    if (isAutoLogout) {
      setEmail("");
      setPassword("");
      toast({
        title: "Sessao expirada",
        description: "Entre novamente para continuar com seguranca.",
        variant: "destructive",
      });
      setAutoLogout(false);
    }
  }, [isAutoLogout, setAutoLogout, toast]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      toast({
        title: "Campos obrigatorios",
        description: "Informe e-mail e senha para acessar o sistema.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Erro de autenticacao:", error);
      if (error?.code === 'auth/user-disabled') {
        toast({
          title: "Conta Inativada",
          description: "Sua conta está desativada no sistema. Entre em contato com a administração.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Acesso negado",
          description: "E-mail ou senha invalidos.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({
        title: "Informe seu e-mail",
        description: "Digite o e-mail acima para receber a recuperacao de senha.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "E-mail enviado",
        description: "Confira sua caixa de entrada para redefinir a senha.",
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail de redefinicao:", error);
      toast({
        title: "Nao foi possivel enviar",
        description: "Verifique o e-mail digitado e tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <main
      className="futuristic-login relative flex min-h-screen overflow-hidden bg-[#07100f] text-white"
      onPointerMove={handlePointerMove}
      style={
        {
          "--pointer-x": `${pointer.x}%`,
          "--pointer-y": `${pointer.y}%`,
        } as React.CSSProperties
      }
    >
      <div className="futuristic-grid" aria-hidden="true" />
      <div className="futuristic-scan" aria-hidden="true" />
      <div className="futuristic-beams" aria-hidden="true" />

      <section className="relative z-10 grid min-h-screen w-full items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)] lg:px-10">
        <div className="flex min-h-[42vh] flex-col justify-between gap-8 lg:min-h-[calc(100vh-5rem)]">
          <header className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/30 bg-white/10 shadow-[0_0_34px_rgba(52,211,153,0.2)] backdrop-blur">
              <img
                src="/imagens/senai.png"
                alt="Logotipo SENAI"
                className="h-8 w-auto object-contain"
                onError={(event) => {
                  event.currentTarget.src = "https://placehold.co/160x60/ffffff/00509d?text=SENAI";
                  event.currentTarget.onerror = null;
                }}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">Macro Micro Schedule</p>
              <p className="text-sm text-white/62">Console de agendamento escolar</p>
            </div>
          </header>

          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/10 px-3 py-1 text-sm text-cyan-100 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Ambiente seguro pronto para iniciar
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Acesse sua rotina em um painel mais rapido, claro e imersivo.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200/78 sm:text-lg">
              Uma entrada futurista para quem precisa abrir o sistema, confirmar agenda e seguir trabalhando sem atrito.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              ["Autenticacao", "Sessao protegida"],
              ["Agenda", "Fluxo escolar"],
              ["UX", "Foco total"],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-300">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[460px]">
          <div className="futuristic-ring" aria-hidden="true" />
          <form
            onSubmit={handleSubmit}
            className="relative z-10 rounded-2xl border border-white/14 bg-[#07100f]/78 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-semibold text-white">Entrar no sistema</h2>
                <p className="mt-1 text-sm text-slate-300">Use suas credenciais institucionais.</p>
              </div>
              <div className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Online
              </div>
            </div>

            <label htmlFor="futuristic-email" className="mb-2 block text-sm font-medium text-slate-200">
              E-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-200/70" />
              <input
                id="futuristic-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-[3.25rem] w-full rounded-xl border border-white/12 bg-white/[0.075] px-12 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-300/70 focus:bg-white/[0.105] focus:ring-4 focus:ring-emerald-300/12"
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </div>

            <label htmlFor="futuristic-password" className="mb-2 mt-5 block text-sm font-medium text-slate-200">
              Senha
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-200/70" />
              <input
                id="futuristic-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-[3.25rem] w-full rounded-xl border border-white/12 bg-white/[0.075] px-12 py-3 pr-14 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-300/70 focus:bg-white/[0.105] focus:ring-4 focus:ring-cyan-300/12"
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((item) => (
                  <span
                    key={item}
                    className={`h-1.5 flex-1 rounded-full transition ${
                      passwordScore > item ? "bg-emerald-300" : "bg-white/12"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleResetPassword}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-cyan-100 transition hover:bg-cyan-100/10 hover:text-white"
              >
                <KeyRound className="h-4 w-4" />
                Recuperar
              </button>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#34d399,#22d3ee_48%,#f59e0b)] px-5 font-semibold text-slate-950 shadow-[0_16px_44px_rgba(34,211,238,0.22)] transition hover:translate-y-[-1px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Autenticando
                </>
              ) : (
                <>
                  Entrar agora
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            <p className="mt-5 text-center text-xs text-slate-400">
              Sessao temporaria neste navegador. Seus dados continuam protegidos pelo Firebase Auth.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
