import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { lightColors, darkColors, type ColorScheme } from '../theme/colors';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  colors: ColorScheme;
  toggleTheme: () => Promise<void>;
  loadTheme: () => Promise<void>;
}

const THEME_KEY = 'theme_mode';

function getColors(mode: ThemeMode): ColorScheme {
  return mode === 'dark' ? darkColors : lightColors;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  colors: lightColors,

  toggleTheme: async () => {
    const newMode: ThemeMode = get().mode === 'light' ? 'dark' : 'light';
    await SecureStore.setItemAsync(THEME_KEY, newMode);
    set({ mode: newMode, colors: getColors(newMode) });
  },

  loadTheme: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === 'dark' || stored === 'light') {
        set({ mode: stored, colors: getColors(stored) });
        return;
      }
    } catch {
      // SecureStore unavailable, use system preference
    }
    const systemTheme = Appearance.getColorScheme() ?? 'light';
    set({ mode: systemTheme, colors: getColors(systemTheme) });
  },
}));
