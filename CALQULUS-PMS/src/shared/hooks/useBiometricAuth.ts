import { useState, useEffect, useCallback } from 'react';
import { biometricService, BiometricAvailability } from '@/shared/services/biometricService';

interface UseBiometricAuth {
  isAvailable: boolean;
  biometryType: 'fingerprint' | 'faceId' | 'iris' | 'none';
  hasStoredCredentials: boolean;
  isLoading: boolean;
  performBiometricLogin: () => Promise<{ email: string; password: string } | null>;
  saveCredentials: (email: string, password: string) => Promise<boolean>;
  deleteCredentials: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useBiometricAuth(): UseBiometricAuth {
  const [availability, setAvailability] = useState<BiometricAvailability>({
    isAvailable: false,
    biometryType: 'none',
  });
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [avail, hasCreds] = await Promise.all([
        biometricService.checkAvailability(),
        biometricService.hasStoredCredentials(),
      ]);
      setAvailability(avail);
      setHasStoredCredentials(hasCreds);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const performBiometricLogin = useCallback(async () => {
    return biometricService.performBiometricLogin();
  }, []);

  const saveCredentials = useCallback(async (email: string, password: string) => {
    const result = await biometricService.saveCredentials(email, password);
    if (result) {
      setHasStoredCredentials(true);
    }
    return result;
  }, []);

  const deleteCredentials = useCallback(async () => {
    const result = await biometricService.deleteCredentials();
    if (result) {
      setHasStoredCredentials(false);
    }
    return result;
  }, []);

  return {
    isAvailable: availability.isAvailable,
    biometryType: availability.biometryType,
    hasStoredCredentials,
    isLoading,
    performBiometricLogin,
    saveCredentials,
    deleteCredentials,
    refreshStatus,
  };
}
