import React, { useContext, useState, useEffect, createContext, ReactNode } from 'react';
import { apiService } from '../services/apiService';

export interface SiraUser {
  uid: string;
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  role?: string;
  unidadeId?: string | null;
  unidade?: { id: string; nome: string; sigla: string } | null;
  perfis?: string[];
}

interface AuthContextType {
  currentUser: SiraUser | null;
  login: (email: string, pass: string) => Promise<any>;
  logout: (isAuto?: boolean) => Promise<void>;
  isAutoLogout: boolean;
  setAutoLogout: (value: boolean) => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SiraUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAutoLogout, setIsAutoLogout] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Inicializa sessão a partir do token armazenado no localStorage
  useEffect(() => {
    const initSession = async () => {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const mappedUser: SiraUser = {
            uid: parsed.id || parsed.uid,
            id: parsed.id || parsed.uid,
            email: parsed.email,
            name: parsed.nome || parsed.name,
            displayName: parsed.nome || parsed.name,
            role: parsed.perfis?.[0] || 'administrador',
            unidadeId: parsed.unidade?.id || parsed.unidadeId || null,
            unidade: parsed.unidade,
            perfis: parsed.perfis || ['administrador'],
          };
          setCurrentUser(mappedUser);

          // Valida token com o backend de forma não-bloqueante
          apiService.getCurrentUser().catch(() => {
            // Se o token expirou e não foi renovado
            console.warn('Sessão expirada no servidor.');
          });
        } catch (err) {
          console.error('Erro ao restaurar sessão local:', err);
          apiService.logout();
          setCurrentUser(null);
        }
      }
      setLoading(false);
    };

    initSession();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      setAuthError(null);
      const res = await apiService.login(email, pass);
      const user = res.user;

      const mappedUser: SiraUser = {
        uid: user.id,
        id: user.id,
        email: user.email,
        name: user.nome,
        displayName: user.nome,
        role: user.perfis?.[0] || 'administrador',
        unidadeId: user.unidade?.id || null,
        unidade: user.unidade,
        perfis: user.perfis || ['administrador'],
      };

      setCurrentUser(mappedUser);
      return res;
    } catch (err: any) {
      const msg = err.message || 'Falha ao autenticar. Verifique e-mail e senha.';
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async (isAuto = false) => {
    if (isAuto) {
      setIsAutoLogout(true);
    }
    await apiService.logout();
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    login,
    logout,
    isAutoLogout,
    setAutoLogout: setIsAutoLogout,
    authError,
    setAuthError,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
