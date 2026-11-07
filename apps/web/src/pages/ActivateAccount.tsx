import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"loading" | "verifying" | "ready" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const code = searchParams.get("oobCode");
    const mode = searchParams.get("mode");

    if (!code || mode !== "resetPassword") {
      setStatus("error");
      setErrorMessage("Link de ativação inválido ou expirado.");
      return;
    }

    setOobCode(code);
    verifyCode(code);
  }, [searchParams]);

  const verifyCode = async (code: string) => {
    setStatus("verifying");
    try {
      const userEmail = await verifyPasswordResetCode(auth, code);
      setEmail(userEmail);
      setStatus("ready");
    } catch (error: any) {
      console.error("Erro ao verificar código:", error);
      setStatus("error");
      setErrorMessage("O link de ativação expirou ou já foi utilizado.");
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;

    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
      
      toast({
        title: "Conta Ativada!",
        description: "Sua senha foi definida com sucesso. Redirecionando...",
      });

      // Login automático após ativação
      if (email) {
        await signInWithEmailAndPassword(auth, email, password);
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        setTimeout(() => navigate("/"), 3000);
      }
    } catch (error: any) {
      console.error("Erro ao confirmar senha:", error);
      toast({
        title: "Erro na ativação",
        description: "Ocorreu um erro ao definir sua senha. Tente novamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground animate-pulse">Verificando seu convite...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-red-100">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-900">Link Inválido</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button variant="outline" onClick={() => navigate("/")}>Voltar para o Início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg border-green-100">
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-green-900">Conta Ativada!</CardTitle>
            <CardDescription>
              Tudo pronto! Sua conta foi ativada com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8">
            <p className="text-sm text-muted-foreground mb-4">Você será redirecionado em instantes...</p>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>Acessar Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-none">
        <CardHeader className="space-y-1 pb-8 text-center border-b mb-6">
          <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-4">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Ativar sua Conta</CardTitle>
          <CardDescription>
            Olá {email}, defina sua senha de acesso para concluir sua ativação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Senha</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-11"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-lg font-semibold transition-all hover:translate-y-[-1px] active:translate-y-[1px]" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                "Ativar Conta"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
