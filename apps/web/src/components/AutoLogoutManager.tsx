import { useState } from 'react';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { InactivityWarning } from '@/components/InactivityWarning';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/AuthContext';

interface AutoLogoutManagerProps {
  timeout?: number; // Tempo em milissegundos (padrão: 30 minutos)
  warningTime?: number; // Tempo para mostrar aviso (padrão: 5 minutos antes)
}

export function AutoLogoutManager({ 
  timeout = 4 * 60 * 1000, // 4 minutos
  warningTime = 1 * 60 * 1000 // 1 minuto
}: AutoLogoutManagerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();
  const { logout } = useAuth();

  const handleWarning = () => {
    setTimeRemaining(Math.floor(warningTime / 1000)); // Converter para segundos
    setShowWarning(true);
    
    toast({
      title: "Sessão Expirando",
      description: "Sua sessão expirará em breve devido à inatividade.",
      variant: "destructive"
    });
  };

  const handleExtend = () => {
    setShowWarning(false);
    // Resetar o timer através do hook
    resetTimer();
    toast({
      title: "Sessão Estendida",
      description: "Sua sessão foi estendida com sucesso."
    });
  };

  const handleLogout = async () => {
    setShowWarning(false);
    try {
      await logout(true); // Passar true para indicar logout automático
      // Pequeno delay para garantir que o estado seja atualizado
      setTimeout(() => {
        toast({
          title: "Logout Automático",
          description: "Você foi desconectado devido à inatividade.",
          variant: "destructive"
        });
      }, 100);
    } catch (error) {
      console.error('Erro ao fazer logout automático:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer logout automático.",
        variant: "destructive"
      });
    }
  };

  const { resetTimer } = useAutoLogout({
    timeout,
    warningTime,
    onWarning: handleWarning,
    onLogout: handleLogout
  });

  return (
    <InactivityWarning
      isOpen={showWarning}
      onExtend={handleExtend}
      onLogout={handleLogout}
      timeRemaining={timeRemaining}
    />
  );
}
