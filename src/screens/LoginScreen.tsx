import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authApi, getApiErrorMessage } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState('');
  const biometricAttempted = useRef(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const biometricInfo = useAuthStore((s) => s.biometricInfo);
  const authenticateWithBiometric = useAuthStore((s) => s.authenticateWithBiometric);
  const token = useAuthStore((s) => s.token);

  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasSavedSession = biometricEnabled && token !== null;

  const handleBiometricLogin = useCallback(async () => {
    setBiometricLoading(true);
    setError('');
    try {
      const result = await authenticateWithBiometric();
      if (!result.success) {
        if (result.reason === 'lockout') {
          setError('Biometrija privremeno zaključana. Koristite email i lozinku.');
        } else if (result.reason === 'no_token') {
          setError('Sesija je istekla. Prijavite se ponovo.');
        }
      }
    } catch {
      setError('Biometrijska prijava nije uspela.');
    } finally {
      setBiometricLoading(false);
    }
  }, [authenticateWithBiometric]);

  useEffect(() => {
    if (hasSavedSession && !biometricAttempted.current) {
      biometricAttempted.current = true;
      void handleBiometricLogin();
    }
  }, [hasSavedSession, handleBiometricLogin]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Unesite email i lozinku.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: envelope } = await authApi.login(email.trim(), password);
      await setAuth(envelope.data.accessToken, envelope.data.user);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Greška pri prijavi. Proverite kredencijale.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Auditera</Text>
        <Text style={styles.subtitle}>Dostava računa</Text>

        {hasSavedSession && (
          <>
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={handleBiometricLogin}
              disabled={biometricLoading}
              accessibilityLabel={biometricInfo.label}
              accessibilityRole="button"
            >
              {biometricLoading ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  <Text style={styles.biometricIcon}>
                    {biometricInfo.biometryType === 'face-id' ? '👤' : '🔒'}
                  </Text>
                  <Text style={styles.biometricBtnText}>{biometricInfo.label}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ili unesite kredencijale</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Lozinka"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Prijavi se"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.brandText} />
          ) : (
            <Text style={styles.primaryBtnText}>Prijavi se</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Za pristup je potreban nalog na{' '}
            <Text style={styles.infoLink}>demo.auditera.ostrichtech.rs</Text>
            {'. '}
            Ukoliko ga nemate, kontaktirajte administratora.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    title: { fontSize: 32, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 32 },
    biometricBtn: {
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.brand,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    biometricIcon: { fontSize: 24 },
    biometricBtnText: { color: colors.brand, fontSize: 17, fontWeight: '600' },
    input: {
      backgroundColor: colors.inputBackground,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      fontSize: 15,
      color: colors.inputText,
      marginBottom: 10,
    },
    primaryBtn: {
      backgroundColor: colors.brand,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryBtnText: { color: colors.brandText, fontSize: 16, fontWeight: '600' },
    error: { color: colors.error, fontSize: 13, marginBottom: 8, textAlign: 'center' },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { marginHorizontal: 12, color: colors.textMuted, fontSize: 13 },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 24,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
    },
    infoLink: {
      color: colors.brand,
      fontWeight: '500',
    },
  });
}
