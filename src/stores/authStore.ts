import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  employeeId: string | null;
  defaultTenantId: string | null;
}

export interface BiometricInfo {
  available: boolean;
  biometryType: 'face-id' | 'fingerprint' | 'none';
  label: string;
}

export type BiometricResult =
  | { success: true }
  | { success: false; reason: 'cancelled' | 'lockout' | 'no_token' | 'disabled' | 'error' };

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  biometricEnabled: boolean;
  biometricInfo: BiometricInfo;
  showBiometricPrompt: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  dismissBiometricPrompt: () => void;
  authenticateWithBiometric: () => Promise<BiometricResult>;
}

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_PROMPTED_KEY = 'biometric_prompted';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.email === 'string' &&
    Array.isArray(v.roles) &&
    v.roles.every((r: unknown) => typeof r === 'string')
  );
}

export async function checkBiometricAvailability(): Promise<BiometricInfo> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { available: false, biometryType: 'none', label: '' };
  }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const hasFaceId = types.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
  );
  const hasFingerprint = types.includes(
    LocalAuthentication.AuthenticationType.FINGERPRINT,
  );

  if (hasFaceId && Platform.OS === 'ios') {
    return { available: true, biometryType: 'face-id', label: 'Face ID prijava' };
  }

  if (hasFingerprint || hasFaceId) {
    return {
      available: true,
      biometryType: 'fingerprint',
      label: Platform.OS === 'ios' ? 'Touch ID prijava' : 'Otisak prsta',
    };
  }

  return { available: false, biometryType: 'none', label: '' };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  biometricEnabled: false,
  biometricInfo: { available: false, biometryType: 'none', label: '' },
  showBiometricPrompt: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));

    const info = get().biometricInfo.available ? get().biometricInfo : await checkBiometricAvailability();
    const alreadyPrompted = await SecureStore.getItemAsync(BIOMETRIC_PROMPTED_KEY);
    const biometricAlreadyEnabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);

    const shouldPrompt = info.available && alreadyPrompted !== 'true' && biometricAlreadyEnabled !== 'true';

    set({
      token,
      user,
      isAuthenticated: true,
      biometricInfo: info,
      showBiometricPrompt: shouldPrompt,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
    set({ token: null, user: null, isAuthenticated: false, biometricEnabled: false });
  },

  bootstrap: async () => {
    const info = await checkBiometricAvailability();

    let biometricEnabled = false;
    try {
      const stored = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      biometricEnabled = stored === 'true' && info.available;
    } catch {
      // Default disabled
    }

    let token: string | null = null;
    let user: AuthUser | null = null;
    try {
      token = await SecureStore.getItemAsync('auth_token');
      const userJson = await SecureStore.getItemAsync('auth_user');
      if (token && userJson) {
        const parsed: unknown = JSON.parse(userJson);
        if (isAuthUser(parsed)) {
          user = parsed;
        } else {
          token = null;
        }
      }
    } catch {
      // Corrupted store
    }

    if (token && isTokenExpired(token)) {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
      token = null;
      user = null;
    }

    const hasValidSession = token !== null && user !== null;

    if (hasValidSession && biometricEnabled) {
      set({ token, user, biometricEnabled, biometricInfo: info, isBootstrapping: false, isAuthenticated: false });
    } else if (hasValidSession) {
      set({ token, user, isAuthenticated: true, biometricEnabled, biometricInfo: info, isBootstrapping: false });
    } else {
      set({ biometricEnabled: false, biometricInfo: info, isBootstrapping: false });
    }
  },

  setBiometricEnabled: async (enabled) => {
    if (enabled && !get().token) return;
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, String(enabled));
    await SecureStore.setItemAsync(BIOMETRIC_PROMPTED_KEY, 'true');
    set({ biometricEnabled: enabled, showBiometricPrompt: false });
  },

  dismissBiometricPrompt: () => {
    void SecureStore.setItemAsync(BIOMETRIC_PROMPTED_KEY, 'true');
    set({ showBiometricPrompt: false });
  },

  authenticateWithBiometric: async (): Promise<BiometricResult> => {
    const { token } = get();
    if (!token) return { success: false, reason: 'no_token' };

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Potvrdite identitet za pristup aplikaciji',
      cancelLabel: 'Otkaži',
      disableDeviceFallback: true,
    });

    if (result.success) {
      set({ isAuthenticated: true });
      return { success: true };
    }

    const reason = result.error === 'lockout' ? 'lockout' as const : 'cancelled' as const;
    return { success: false, reason };
  },
}));
