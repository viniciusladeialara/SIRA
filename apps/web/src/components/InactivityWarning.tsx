import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Clock } from 'lucide-react';

interface InactivityWarningProps {
  isOpen: boolean;
  onExtend: () => void;
  onLogout: () => void;
  timeRemaining: number; // em segundos
}

export function InactivityWarning({ isOpen, onExtend, onLogout, timeRemaining }: InactivityWarningProps) {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(timeRemaining);
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeRemaining, onLogout]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sessão Expirando
          </DialogTitle>
          <DialogDescription>
            Sua sessão expirará em breve devido à inatividade. 
            Clique em "Continuar" para manter a sessão ativa ou "Sair" para fazer logout.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-amber-600">
              {formatTime(countdown)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Tempo restante
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onLogout}
            className="flex-1"
          >
            Sair
          </Button>
          <Button 
            onClick={onExtend}
            className="flex-1"
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
