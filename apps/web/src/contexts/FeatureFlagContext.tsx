import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiService } from '../services/apiService';

interface FeatureFlagContextType {
  flags: Record<string, boolean>;
  isEnabled: (flagName: string) => boolean;
  refreshFlags: () => Promise<void>;
  loading: boolean;
}

const DEFAULT_FLAGS: Record<string, boolean> = {
  optimizer_enabled: false,
  reports_enabled: true,
  teacher_swap_enabled: true,
  dashboard_advanced: true,
  experimental_scheduler: false,
};

const FeatureFlagContext = createContext<FeatureFlagContextType>({
  flags: DEFAULT_FLAGS,
  isEnabled: (flagName: string) => DEFAULT_FLAGS[flagName] ?? false,
  refreshFlags: async () => {},
  loading: false,
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      const data = await apiService.getFeatureFlags();
      setFlags((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.warn('Erro ao carregar feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const isEnabled = (flagName: string): boolean => {
    return flags[flagName] ?? false;
  };

  return (
    <FeatureFlagContext.Provider
      value={{
        flags,
        isEnabled,
        refreshFlags: fetchFlags,
        loading,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}
