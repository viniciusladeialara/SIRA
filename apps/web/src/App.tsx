// --- Importações de Bibliotecas e Componentes de UI ---
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// --- Importações de Autenticação e Páginas ---
// Importa o nosso provedor de autenticação e o hook customizado
import { AuthProvider, useAuth } from "./lib/AuthContext";
// Importa os componentes de UI que serão as nossas páginas
import PublicView from "./components/modules/PublicView";
import StandbyNotice from "./components/common/StandbyNotice";
import PublicEventosView from "./modules/core-eventos/components/PublicEventosView";
import { Login } from "./components/Login";
import { LoginFormAnimation } from "./components/LoginFormAnimation";
import { LoginFuturistic } from "./components/LoginFuturistic";
import Dashboard from "./components/Dashboard";
import ActivateAccount from "./pages/ActivateAccount";
import NotFound from "./pages/NotFound";
// Importa o gerenciador de logout automático
import { AutoLogoutManager } from "./components/AutoLogoutManager";
import { useSystemConfig } from "./hooks/useSystemConfig";

// Cria uma instância do QueryClient para o react-query
const queryClient = new QueryClient();

// --- Componente que Gere as Rotas ---
// Este componente decide qual página mostrar com base no estado de autenticação
function AppRoutes() {
  const { currentUser } = useAuth();
  const { config } = useSystemConfig();

  const loginVariant = config.loginVariant ?? "senai";
  const LoginPage =
    loginVariant === "futuristic"
      ? LoginFuturistic
      : loginVariant === "animation"
        ? LoginFormAnimation
        : Login;

  return (
    <>
      <Routes>
        {/* Rota Principal */}
        <Route
          path="/"
          // Se não houver utilizador, mostra o Login. Se houver, redireciona para o Dashboard.
          element={!currentUser ? <LoginPage /> : <Navigate to="/dashboard" />}
        />
        {/* Rota do Dashboard */}
        <Route
          path="/dashboard"
          // Se houver utilizador, mostra o Dashboard. Se não, redireciona para o Login.
          element={currentUser ? (
            <>
              {/* Gerenciador de logout automático - só ativo no Dashboard */}
              <AutoLogoutManager
                timeout={4 * 60 * 1000} // 4 minutos
                warningTime={1 * 60 * 1000} // 1 minuto de aviso
              />
              <Dashboard />
            </>
          ) : <Navigate to="/" />}
        />
        {/* Rota para páginas não encontradas */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

// --- Componente Principal da Aplicação ---
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <Routes>
          {/* Rotas Públicas fora do AuthProvider */}
          <Route path="/public-view" element={<PublicView />} />
          <Route path="/public-view/:unitId" element={<PublicView />} />
          <Route path="/painel-aulas" element={<StandbyNotice title="Painel de Aulas em Standby" description="Monitoramento contínuo em tempo real pausado para contenção de leituras do Firestore." />} />
          <Route path="/painel-aulas/:unitId" element={<StandbyNotice title="Painel de Aulas em Standby" description="Monitoramento contínuo em tempo real pausado para contenção de leituras do Firestore." />} />
          <Route path="/monitor-ambientes" element={<StandbyNotice title="Monitor de Ambientes em Standby" description="Monitoramento contínuo pausado para otimização de custos de nuvem." />} />
          <Route path="/monitor-ambientes/:unitId" element={<StandbyNotice title="Monitor de Ambientes em Standby" description="Monitoramento contínuo pausado para otimização de custos de nuvem." />} />
          <Route path="/dashboard-publico" element={<StandbyNotice title="BI Dashboard em Standby" description="Painel executivo de 14 coleções pausado para economia de recursos de nuvem." />} />
          <Route path="/activate-account" element={<ActivateAccount />} />
          
          {/* Rotas Públicas do CORE Eventos (Sem brechas para dentro do sistema) */}
          <Route path="/eventos-view" element={<PublicEventosView />} />
          <Route path="/eventos-view/:eventId" element={<PublicEventosView />} />
          <Route path="/painel-eventos" element={<PublicEventosView />} />
          <Route path="/painel-eventos/:eventId" element={<PublicEventosView />} />
          
          {/* Rotas Protegidas dentro do AuthProvider */}
          <Route
            path="*"
            element={
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
