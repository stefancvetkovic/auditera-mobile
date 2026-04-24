export interface ColorScheme {
  background: string;
  surface: string;
  surfacePressed: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  brand: string;
  brandText: string;
  error: string;
  badgeFiscalBg: string;
  badgeFiscalText: string;
  badgeImageBg: string;
  badgeImageText: string;
  badgeCategoryBg: string;
  badgeCategoryText: string;
  tabActive: string;
  tabInactive: string;
  overlay: string;
  headerBackground: string;
  headerText: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  switchTrackOn: string;
  switchTrackOff: string;
}

export const lightColors: ColorScheme = {
  background: '#f8f9fa',
  surface: '#ffffff',
  surfacePressed: '#f0f0f0',
  border: '#ddd',
  text: '#1a1a2e',
  textSecondary: '#666',
  textMuted: '#999',
  brand: '#1a1a2e',
  brandText: '#ffffff',
  error: '#e53935',
  badgeFiscalBg: '#e8f5e9',
  badgeFiscalText: '#2e7d32',
  badgeImageBg: '#e3f2fd',
  badgeImageText: '#1565c0',
  badgeCategoryBg: '#fff3e0',
  badgeCategoryText: '#e65100',
  tabActive: '#1a1a2e',
  tabInactive: '#999',
  overlay: 'rgba(0,0,0,0.5)',
  headerBackground: '#ffffff',
  headerText: '#1a1a2e',
  inputBackground: '#ffffff',
  inputBorder: '#ddd',
  inputText: '#1a1a2e',
  switchTrackOn: '#1a1a2e',
  switchTrackOff: '#ccc',
};

export const darkColors: ColorScheme = {
  background: '#121212',
  surface: '#1e1e2e',
  surfacePressed: '#2a2a3e',
  border: '#3a3a5c',
  text: '#f0f0f5',
  textSecondary: '#a0a0b0',
  textMuted: '#707080',
  brand: '#4a4ae0',
  brandText: '#ffffff',
  error: '#ff6b6b',
  badgeFiscalBg: '#1b3d1f',
  badgeFiscalText: '#6fcf6f',
  badgeImageBg: '#1a2e42',
  badgeImageText: '#64b5f6',
  badgeCategoryBg: '#3d2800',
  badgeCategoryText: '#ffb74d',
  tabActive: '#f0f0f5',
  tabInactive: '#707080',
  overlay: 'rgba(0,0,0,0.7)',
  headerBackground: '#1e1e2e',
  headerText: '#f0f0f5',
  inputBackground: '#1e1e2e',
  inputBorder: '#3a3a5c',
  inputText: '#f0f0f5',
  switchTrackOn: '#4a4ae0',
  switchTrackOff: '#3a3a5c',
};
