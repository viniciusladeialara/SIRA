import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";
import "./Login.css";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();
  const { login, isAutoLogout, setAutoLogout, authError, setAuthError } = useAuth();

  useEffect(() => {
    if (authError) {
      toast({
        title: "Acesso Negado",
        description: authError,
        variant: "destructive"
      });
      setAuthError(null);
    }
  }, [authError, setAuthError, toast]);

  useEffect(() => {
    if (isAutoLogout) {
      toast({
        title: "Sessão expirada",
        description: "Você foi desconectado por inatividade. Faça login novamente.",
        variant: "destructive"
      });
      setAutoLogout(false);
    }
  }, [isAutoLogout, setAutoLogout, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Erro", description: "Por favor, preencha todos os campos", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast({ title: "Sucesso!", description: "Autenticação realizada com sucesso no SIRA." });
    } catch (error: any) {
      console.error("Erro de autenticação:", error);
      toast({ title: "Erro de Autenticação", description: error?.message || "E-mail ou senha inválidos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast({ title: "Erro", description: "Por favor, insira seu e-mail para recuperar a senha.", variant: "destructive" });
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Sucesso!", description: "Um e-mail para redefinição de senha foi enviado.", });
    } catch (error) {
      console.error("Erro ao enviar e-mail de redefinição:", error);
      toast({ title: "Erro", description: "Não foi possível enviar o e-mail. Verifique se o e-mail está correto.", variant: "destructive" });
    }
  };

  return (
    <div className="login-container">
      <div className="login-content">
        {/* Logo SENAI */}
        <img
          src="/imagens/senai.png"
          alt="Logótipo SENAI"
          className="login-logo"
          onError={(e) => { e.currentTarget.src = 'https://placehold.co/200x60/ffffff/00509d?text=SENAI'; e.currentTarget.onerror = null; }}
        />

        <div className="login-card">
          <div className="login-card-header">
            <h2>Acesso ao Sistema</h2>
            <p>Agendamento de Ambiente Escolar</p>
          </div>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="password">Senha</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="forgot-password-wrapper">
              <button
                type="button"
                onClick={handleResetPassword}
                className="forgot-password-link"
              >
                Esqueci minha senha
              </button>
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <div className="loader-small"></div>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
          
          <div className="login-footer">
            <p>&copy; 2024 @viniciusladeialara</p>
          </div>
        </div>
      </div>

      {/* Imagem do autor com Tooltip */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <img
              src="/imagens/autor.png"
              alt="Autor do Projeto"
              className="author-image"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Desenvolvido por <b className="font-semibold">Vinícius Lara</b></p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}