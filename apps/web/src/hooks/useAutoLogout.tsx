import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface UseAutoLogoutOptions {
  timeout?: number; // Tempo em milissegundos (padrão: 30 minutos)
  warningTime?: number; // Tempo para mostrar aviso (padrão: 5 minutos antes)
  onWarning?: () => void; // Callback quando mostrar aviso
  onLogout?: () => void; // Callback quando fazer logout
}

/**
 * Hook para logout automático por inatividade
 * Monitora atividade do usuário e faz logout após período de inatividade
 */
export function useAutoLogout({
  timeout = 4 * 60 * 1000, // 4 minutos
  warningTime = 1 * 60 * 1000, // 1 minuto
  onWarning,
  onLogout
}: UseAutoLogoutOptions = {}) {
  const { currentUser, logout } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Função para resetar o timer
  const resetTimer = () => {
    if (!currentUser) return;

    lastActivityRef.current = Date.now();

    // Limpar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Timer para aviso
    warningTimeoutRef.current = setTimeout(() => {
      if (onWarning) {
        onWarning();
      }
    }, timeout - warningTime);

    // Timer para logout
    timeoutRef.current = setTimeout(async () => {
      try {
        await logout(true); // Passar true para indicar logout automático
        if (onLogout) {
          onLogout();
        }
      } catch (error) {
        console.error('Erro ao fazer logout automático:', error);
      }
    }, timeout);
  };

  // Função para detectar atividade
  const handleActivity = () => {
    resetTimer();
  };

  useEffect(() => {
    if (!currentUser) {
      // Limpar timers se não há usuário logado
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      return;
    }

    // Eventos que indicam atividade
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Adicionar listeners para todos os eventos
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Iniciar o timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [currentUser, timeout, warningTime, onWarning, onLogout, logout]);

  return {
    resetTimer,
    lastActivity: lastActivityRef.current
  };
}
