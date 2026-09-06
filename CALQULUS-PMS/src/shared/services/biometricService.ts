import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const SERVER_IDENTIFIER = 'app.calqulusrms.credentials';

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: 'fingerprint' | 'faceId' | 'iris' | 'none';
}

export const biometricService = {
  /**
   * Check if biometric authentication is available on the device
   */
  async checkAvailability(): Promise<BiometricAvailability> {
    // Only available on native platforms
    if (!Capacitor.isNativePlatform()) {
      return { isAvailable: false, biometryType: 'none' };
    }

    try {
      const result = await NativeBiometric.isAvailable();
      
      let biometryType: 'fingerprint' | 'faceId' | 'iris' | 'none' = 'none';
      
      switch (result.biometryType) {
        case BiometryType.FACE_ID:
        case BiometryType.FACE_AUTHENTICATION:
          biometryType = 'faceId';
          break;
        case BiometryType.FINGERPRINT:
        case BiometryType.TOUCH_ID:
          biometryType = 'fingerprint';
          break;
        case BiometryType.IRIS_AUTHENTICATION:
          biometryType = 'iris';
          break;
        default:
          biometryType = result.isAvailable ? 'fingerprint' : 'none';
      }

      return {
        isAvailable: result.isAvailable,
        biometryType,
      };
    } catch (error) {
      return { isAvailable: false, biometryType: 'none' };
    }
  },

  /**
   * Verify user identity using biometrics
   */
  async verifyIdentity(reason?: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: reason || 'Authenticate to access CALQULUS PMS',
        title: 'Biometric Login',
        subtitle: 'Use your fingerprint or face to log in',
        description: 'Place your finger on the sensor or look at the camera',
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Save credentials securely for biometric login
   */
  async saveCredentials(email: string, password: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: SERVER_IDENTIFIER,
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get stored credentials after biometric verification
   */
  async getCredentials(): Promise<{ email: string; password: string } | null> {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      const credentials = await NativeBiometric.getCredentials({
        server: SERVER_IDENTIFIER,
      });
      return {
        email: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if credentials are stored
   */
  async hasStoredCredentials(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const credentials = await NativeBiometric.getCredentials({
        server: SERVER_IDENTIFIER,
      });
      return !!credentials.username && !!credentials.password;
    } catch {
      return false;
    }
  },

  /**
   * Delete stored credentials
   */
  async deleteCredentials(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      await NativeBiometric.deleteCredentials({
        server: SERVER_IDENTIFIER,
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Perform full biometric login flow
   * 1. Verify identity with biometrics
   * 2. Retrieve stored credentials
   * Returns credentials if successful, null otherwise
   */
  async performBiometricLogin(): Promise<{ email: string; password: string } | null> {
    const availability = await this.checkAvailability();
    
    if (!availability.isAvailable) {
      return null;
    }

    const hasCredentials = await this.hasStoredCredentials();
    if (!hasCredentials) {
      return null;
    }

    const verified = await this.verifyIdentity();
    if (!verified) {
      return null;
    }

    return this.getCredentials();
  },
};
