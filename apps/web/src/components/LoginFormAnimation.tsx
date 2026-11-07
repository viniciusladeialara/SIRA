import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import {
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";

type LampModelProps = {
  isOn: boolean;
  onToggle: () => void;
};

function LampModel({ isOn, onToggle }: LampModelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [springOffset, setSpringOffset] = useState({ x: 0, y: 0 });
  const startPointRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    setIsDragging(true);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    startPointRef.current = { x: e.clientX, y: e.clientY };
    setSpringOffset({ x: 0, y: 0 });
    setDragOffset({ x: 0, y: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPointRef.current.x;
    const deltaY = e.clientY - startPointRef.current.y;
    setDragOffset({
      x: Math.max(-34, Math.min(34, deltaX * 0.5)),
      y: Math.max(0, Math.min(68, deltaY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const finalOffset = dragOffset;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Se puxou mais que 25px, alterna o abajur
    if (finalOffset.y >= 25) {
      onToggle();
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(40); // Feedback vibratório no celular
      }
    }

    if (finalOffset.y > 0 || Math.abs(finalOffset.x) > 0) {
      const startedAt = performance.now();
      const duration = 1100;
      const animateSpring = (now: number) => {
        const elapsed = now - startedAt;
        const progress = Math.min(elapsed / duration, 1);
        const damping = Math.exp(-4.4 * progress);
        const wobble = Math.cos(progress * Math.PI * 7.5);

        setSpringOffset({
          x: finalOffset.x * damping * wobble,
          y: finalOffset.y * damping * wobble,
        });

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animateSpring);
        } else {
          setSpringOffset({ x: 0, y: 0 });
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(animateSpring);
    }
    setDragOffset({ x: 0, y: 0 });
  };

  const pullOffset = isDragging ? dragOffset : springOffset;
  const chainBeads = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const slack = Math.sin(t * Math.PI) * pullOffset.x * 0.16;
    return {
      x: pullOffset.x * Math.pow(t, 1.58) + slack,
      y: 16 + t * (78 + pullOffset.y),
      scale: 0.84 + t * 0.2,
    };
  });
  const handleX = pullOffset.x;
  const handleY = 101 + pullOffset.y;

  return (
    <div className="relative mx-auto flex h-[430px] w-full max-w-[460px] items-end justify-center overflow-hidden rounded-[24px] bg-transparent select-none">
      <div
        className={`absolute left-1/2 top-8 h-52 w-72 -translate-x-1/2 rounded-full blur-3xl transition duration-1000 ease-in-out ${
          isOn ? "bg-amber-300/30 opacity-100" : "bg-slate-500/10 opacity-20"
        }`}
      />
      <div
        className={`absolute left-1/2 top-20 h-64 w-[320px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.48),_rgba(251,191,36,0.14)_42%,_transparent_72%)] transition duration-1000 ease-in-out ${
          isOn ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="absolute bottom-9 h-8 w-64 rounded-full bg-black/30 blur-xl" />

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="group absolute left-[calc(50%+18px)] top-[258px] z-20 h-[190px] w-24 -translate-x-1/2 outline-none select-none cursor-pointer touch-none"
        aria-pressed={isOn}
        aria-label={isOn ? "Apagar abajur" : "Acender abajur"}
      >
        {/* Tampa/Suporte da corrente saindo de dentro da cúpula */}
        <span className={`absolute left-1/2 top-0 h-3 w-4 -translate-x-1/2 rounded-t-sm bg-gradient-to-b from-slate-400 to-slate-500 transition-colors duration-500 ${isOn ? "from-amber-300 to-amber-500" : "group-hover:from-slate-300 group-hover:to-slate-400"}`} />

        {/* Corrente com topo fixo e corpo elastico */}
        <div className="absolute left-1/2 top-0 h-[172px] w-24 -translate-x-1/2">
          <span
            className={`absolute left-1/2 top-[10px] h-3 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-500 ${
              isOn ? "bg-amber-300" : "bg-slate-400 group-hover:bg-slate-300"
            }`}
          />
          {chainBeads.map((bead, i) => (
            <span
              key={i}
              style={{
                transform: `translate(calc(-50% + ${bead.x}px), ${bead.y}px) scale(${bead.scale})`,
              }}
              className={`absolute left-1/2 top-0 h-[6px] w-[6px] rounded-full border border-slate-600/30 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 shadow-[0_1px_1px_rgba(0,0,0,0.15)] transition-colors duration-500 ${
                isOn
                  ? "from-amber-200 via-amber-300 to-amber-500 border-amber-300/20 shadow-[0_0_4px_rgba(251,191,36,0.4)]"
                  : "group-hover:from-slate-200 group-hover:via-slate-300 group-hover:to-slate-400"
              }`}
            />
          ))}
        </div>

        {/* Elo de conexão do puxador */}
        <span
          style={{ transform: `translate(calc(-50% + ${handleX}px), ${handleY - 7}px)` }}
          className={`absolute left-1/2 top-0 h-2 w-[2px] bg-slate-500 transition-colors duration-500 ${isOn ? "bg-amber-400" : "group-hover:bg-slate-300"}`}
        />

        {/* Puxador clássico em gota de latão polido */}
        <div
          style={{ transform: `translate(calc(-50% + ${handleX}px), ${handleY}px)` }}
          className={`absolute left-1/2 top-0 h-8 w-[16px] rounded-t-[4px] rounded-b-[12px] border transition-colors duration-700 ease-in-out ${
            isOn
              ? "border-amber-200 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 shadow-[0_0_20px_rgba(251,191,36,0.85),_0_6px_10px_rgba(0,0,0,0.4)] scale-110"
              : "border-slate-500 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-800 shadow-[0_4px_6px_rgba(0,0,0,0.5)] group-hover:border-slate-400 group-hover:from-slate-400 group-hover:via-slate-500 group-hover:to-slate-700"
          }`}
        />
      </button>

      <div className="relative z-10 flex flex-col items-center">
        <div
          className={`h-4 w-24 rounded-t-full transition duration-1000 ease-in-out ${
            isOn
              ? "bg-amber-200/95 shadow-[0_0_36px_rgba(251,191,36,0.65)]"
              : "bg-slate-500/70 shadow-none"
          }`}
        />
        <div
          className={`relative h-24 w-56 overflow-hidden rounded-t-[76px] border transition duration-1000 ease-in-out ${
            isOn
              ? "border-amber-100/55 bg-[linear-gradient(180deg,_rgba(254,243,199,0.96),_rgba(245,158,11,0.72))] shadow-[0_22px_70px_rgba(251,191,36,0.34)]"
              : "border-slate-600/60 bg-[linear-gradient(180deg,_rgba(51,65,85,0.95),_rgba(15,23,42,0.9))] shadow-none"
          }`}
        >
          <div className={`absolute inset-x-8 top-0 h-full bg-white/18 blur-xl transition duration-1000 ease-in-out ${isOn ? "opacity-100" : "opacity-0"}`} />
          <div className="absolute bottom-0 left-0 right-0 h-5 bg-amber-950/20" />
          <div className="absolute inset-x-0 top-9 flex items-center justify-center">
            <div className={`flex items-center gap-8 transition duration-700 ease-in-out ${isOn ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
              <span className="h-4 w-4 rounded-full bg-slate-900/85 shadow-[0_0_8px_rgba(255,255,255,0.18)]" />
              <span className="h-4 w-4 rounded-full bg-slate-900/85 shadow-[0_0_8px_rgba(255,255,255,0.18)]" />
            </div>
            <div className={`absolute flex items-center gap-7 transition duration-700 ease-in-out ${isOn ? "opacity-0 scale-105" : "opacity-100 scale-100"}`}>
              <span className="h-3 w-8 rounded-b-full border-b-2 border-slate-200/80" />
              <span className="h-3 w-8 rounded-b-full border-b-2 border-slate-200/80" />
            </div>
          </div>
          <div className="absolute inset-x-0 top-[62px] flex justify-center">
            <span
              className={`transition duration-1000 ease-in-out ${
                isOn
                  ? "h-3 w-8 rounded-b-full border-b-2 border-slate-900/70"
                  : "h-2 w-6 rounded-full bg-slate-200/70"
              }`}
            />
          </div>
        </div>
        <div className="h-28 w-3 bg-gradient-to-b from-amber-100 to-slate-500 shadow-[0_0_22px_rgba(251,191,36,0.35)]" />
        <div className="h-7 w-40 rounded-t-full bg-gradient-to-r from-slate-700 via-slate-300 to-slate-700" />
        <div className="h-4 w-52 rounded-full bg-slate-900 shadow-[0_14px_30px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  );
}

export function LoginFormAnimation() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lampOn, setLampOn] = useState(false);

  const { toast } = useToast();
  const { authError, setAuthError } = useAuth();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Preencha e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Erro de autenticação:", error);
      if (error?.code === 'auth/user-disabled') {
        toast({
          title: "Conta Inativada",
          description: "Sua conta está desativada no sistema. Entre em contato com a administração.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro de Autenticação",
          description: "E-mail ou senha inválidos.",
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
        title: "Erro",
        description: "Informe seu e-mail para redefinir a senha.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Sucesso", description: "E-mail de recuperação enviado." });
    } catch (error) {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail. Verifique o endereço digitado.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className={`flex min-h-screen items-center justify-center p-4 text-white transition duration-1000 ease-in-out sm:p-6 ${
        lampOn
          ? "bg-[radial-gradient(circle_at_top,_#172554_0%,_#0f172a_42%,_#020617_100%)]"
          : "bg-[radial-gradient(circle_at_top,_#020617_0%,_#020617_55%,_#000_100%)]"
      }`}
    >
      <div
        className={`grid w-full overflow-hidden rounded-[28px] border shadow-[0_24px_60px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-1000 ease-in-out max-w-2xl lg:max-w-7xl lg:grid-cols-[1.02fr_0.98fr] ${
          lampOn
            ? "border-white/10 bg-white/6"
            : "border-white/5 bg-black/30"
        }`}
      >
        <section
          className={`relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden p-8 transition duration-1000 ease-in-out md:p-12 w-full ${
            lampOn
              ? "bg-[linear-gradient(140deg,_rgba(14,165,233,0.12),_rgba(15,23,42,0.98)_44%,_rgba(120,53,15,0.74))]"
              : "bg-slate-950"
          }`}
        >
          <div className={`absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_at_bottom,_rgba(251,191,36,0.22),_transparent_68%)] transition duration-1000 ease-in-out ${lampOn ? "opacity-100" : "opacity-0"}`} />
          <div className="hidden">
          </div>

          <div className="relative z-10 w-full">
            <LampModel isOn={lampOn} onToggle={() => setLampOn((current) => !current)} />
          </div>

          <div className="hidden">
            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h2 className="mt-3 text-base font-semibold">Agenda organizada</h2>
              <p className="mt-1 text-slate-300">Acesso direto ao painel principal para acompanhar a rotina escolar.</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <h2 className="mt-3 text-base font-semibold">Ambiente iluminado</h2>
              <p className="mt-1 text-slate-300">O abajur destaca a segunda tela sem competir com o formulário.</p>
            </article>
          </div>
        </section>

        <section
          className={`items-center justify-center bg-slate-950/95 p-6 transition-all duration-1000 ease-in-out md:p-10 w-full ${
            lampOn
              ? "flex opacity-100 scale-100 pointer-events-auto animate-in fade-in duration-1000"
              : "hidden lg:flex lg:opacity-0 lg:scale-95 lg:pointer-events-none pointer-events-none opacity-0"
          }`}
          aria-hidden={!lampOn}
        >
          <form onSubmit={handleSubmit} className="w-full max-w-md animate-[pulse_6s_ease-in-out_infinite] rounded-[26px] border border-white/10 bg-white/8 p-6 shadow-2xl">
            <div className="mb-6 text-center">
              <img
                src="/imagens/senai.png"
                alt="Logotipo SENAI"
                className="mx-auto mb-5 h-16 w-auto"
                onError={(e) => {
                  e.currentTarget.src = "https://placehold.co/200x60/ffffff/00509d?text=SENAI";
                  e.currentTarget.onerror = null;
                }}
              />
              <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200/90">Entrar</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Bem-vindo de volta</h2>
              <p className="mt-2 text-sm text-slate-300">Use suas credenciais para continuar.</p>
            </div>

            <label className="mb-2 block text-sm text-slate-200">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/30"
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />

            <label className="mb-2 mt-4 block text-sm text-slate-200">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 pr-12 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/30"
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-sky-200 hover:text-sky-100"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
