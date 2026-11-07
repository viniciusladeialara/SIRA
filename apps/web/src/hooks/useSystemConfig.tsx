import { useState, useEffect } from 'react';
import { db } from "@/lib/db";
import { doc, setDoc, onSnapshot } from "@/lib/sira-sql-adapter";

export type LoginVariant = 'senai' | 'animation' | 'futuristic';

export interface SystemConfig {
  loginVariant: LoginVariant;
  updatedAt?: Date;
  updatedBy?: string;
  portalDocenteLink?: string;
  portalDocenteLabel?: string;
  meuSenaiLink?: string;
  meuSenaiLabel?: string;
  pesquisaSensorialLink?: string;
  pesquisaSensorialLabel?: string;
  gradePublicaLink?: string;
  gradePublicaLabel?: string;
}

const DEFAULT_CONFIG: SystemConfig = {
  loginVariant: 'senai',
  portalDocenteLink: 'http://educacional.sesisenaimt.ind.br:8081/FrameHTML/web/app/Edu/PortalDoProfessor/#/login',
  portalDocenteLabel: 'Portal Docente',
  meuSenaiLink: 'https://identidade.senai.br/authenticationendpoint/login.do?RelayState=https%3A%2F%2Fmeusenai.senai.br%2F&commonAuthCallerPath=%2Fsamlsso&forceAuth=false&passiveAuth=false&tenantDomain=carbon.super&sessionDataKey=51179269-6e9a-4ef6-9f36-043326f53f60&relyingParty=https%3A%2F%2Fmeusenai.senai.br&type=samlsso&sp=meusenai.senai.br&isSaaSApp=false&authenticators=BasicAuthenticator%3ALOCAL',
  meuSenaiLabel: 'Meu SENAI',
  pesquisaSensorialLink: 'https://script.google.com/macros/s/AKfycbzuZ6Eq9r0KfITKTgkJGgmiOYYuQ6IUkI90FgfCTMQv5FgDp6l7xz37X8B-vWoYlZKn/exec',
  pesquisaSensorialLabel: 'Pesquisa Sensorial',
  gradePublicaLink: '/public-view',
  gradePublicaLabel: 'Grade Pública',
};

export const useSystemConfig = () => {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const configDocRef = doc(db, 'systemConfig', 'features');
    
    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      configDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...docSnapshot.data()
          } as SystemConfig);
        } else {
          setConfig(DEFAULT_CONFIG);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao carregar configurações do sistema:', err);
        setError(err.message);
        setConfig(DEFAULT_CONFIG);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateConfig = async (newConfig: Partial<SystemConfig>, userId?: string) => {
    try {
      const configDocRef = doc(db, 'systemConfig', 'features');
      await setDoc(configDocRef, {
        ...config,
        ...newConfig,
        updatedAt: new Date(),
        updatedBy: userId,
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao atualizar configurações:', err);
      throw err;
    }
  };



  const setLoginVariant = async (variant: LoginVariant, userId?: string) => {
    await updateConfig({ loginVariant: variant }, userId);
  };

  return {
    config,
    loading,
    error,
    setLoginVariant,
    updateConfig,
  };
};
