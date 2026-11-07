// src/pages/Index.tsx

import { useState, useEffect } from "react";
// Importa os componentes de UI
import { Login } from "@/components/Login";
import Dashboard from "@/components/Dashboard";

// NOVAS IMPORTAÇÕES PARA O FIREBASE
// Importa a instância de autenticação e as funções necessárias
import { auth } from "@/lib/db";
import { onAuthStateChanged, User } from "@/lib/sira-auth-adapter";

const Index = () => {
  // O estado agora irá guardar o objeto do utilizador do Firebase
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Estado de carregamento para evitar que a tela pisque durante a verificação
  const [loading, setLoading] = useState(true);

  // Este efeito é executado uma vez para "ouvir" o estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user); // Atualiza o nosso estado com o utilizador
      setLoading(false); // A verificação terminou, podemos mostrar a tela
    });

    // Limpa o "ouvinte" quando o componente é desmontado
    return unsubscribe;
  }, []);

  // Enquanto o Firebase verifica o estado de login, mostramos uma mensagem de carregamento
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando...
      </div>
    );
  }

  // A lógica principal:
  // Se currentUser existir (utilizador autenticado), mostra o Dashboard.
  // Se não, mostra a tela de Login.
  return (
    <div>
      {currentUser ? (
        // ERRO CORRIGIDO: A prop 'onLogout' foi removida
        <Dashboard />
      ) : (
        // ERRO CORRIGIDO: A prop 'onLogin' foi removida
        <Login />
      )}
    </div>
  );
};

// É uma boa prática exportar como default em arquivos de página
export default Index;