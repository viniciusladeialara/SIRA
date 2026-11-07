import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, User, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SessionStatusProps {
  onLogout?: () => void;
}

export function SessionStatus({ onLogout }: SessionStatusProps) {
  const { currentUser, logout } = useAuth();
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    if (!currentUser) return;

    const updateActivity = () => {
      setLastActivity(new Date());
    };

    // Eventos que indicam atividade
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      if (onLogout) {
        onLogout();
      }
      toast({
        title: "Logout Realizado",
        description: "Você foi desconectado com sucesso."
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer logout.",
        variant: "destructive"
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!currentUser) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4" />
        <span className="text-sm font-medium">
          {currentUser.email}
        </span>
        <Badge variant="secondary" className="text-xs">
          Online
        </Badge>
      </div>
      
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Última atividade: {formatTime(lastActivity)}</span>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="ml-auto h-8 px-2"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
