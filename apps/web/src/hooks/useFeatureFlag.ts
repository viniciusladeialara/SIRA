import { useFeatureFlags } from '../contexts/FeatureFlagContext';

/**
 * Hook para consultar reativamente o estado de uma feature flag
 * @param flagName Nome da feature flag registrada em core.feature_flags
 */
export function useFeatureFlag(flagName: string): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(flagName);
}
