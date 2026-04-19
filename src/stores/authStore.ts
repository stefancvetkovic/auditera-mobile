import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    set({ token: null, user: null, isAuthenticated: false });
  },
  loadToken: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userJson = await SecureStore.getItemAsync('auth_user');
    if (token && userJson) {
      const user: AuthUser = JSON.parse(userJson);
      set({ token, user, isAuthenticated: true });
    }
  },
}));
