import React, { useEffect, useState } from 'react';
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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authApi, getApiErrorMessage } from '../api/client';
import { useAuthStore } from '../stores/authStore';

// Required for redirect handling on web
WebBrowser.maybeCompleteAuthSession();

// TODO: Move to environment config
const ENTRA_CLIENT_ID =
  process.env['EXPO_PUBLIC_ENTRA_CLIENT_ID'] ?? 'YOUR_ENTRA_CLIENT_ID';

const ENTRA_DISCOVERY_URL = 'https://login.microsoftonline.com/common/v2.0';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  const discovery = AuthSession.useAutoDiscovery(ENTRA_DISCOVERY_URL);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: ENTRA_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'auditera' }),
      responseType: AuthSession.ResponseType.IdToken,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params['id_token'];
      if (typeof idToken === 'string' && idToken.length > 0) {
        void handleEntraCallback(idToken);
      } else {
        setError('Microsoft prijava nije uspela: token nije primljen.');
      }
    } else if (response?.type === 'error') {
      setError(
        response.error?.message ?? 'Microsoft prijava nije uspela.',
      );
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Unesite email i lozinku.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.login(email.trim(), password);
      await setAuth(data.accessToken, data.user);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Greška pri prijavi. Proverite kredencijale.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEntraLogin = () => {
    setError('');
    void promptAsync();
  };

  const handleEntraCallback = async (idToken: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.entraLogin(idToken);
      await setAuth(data.accessToken, data.user);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Microsoft prijava nije uspela.'));
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

        <TextInput
          style={styles.input}
          placeholder="Email"
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Prijavi se</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ili</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.microsoftBtn, (!request || loading) && styles.disabledBtn]}
          onPress={handleEntraLogin}
          disabled={!request || loading}
          accessibilityLabel="Prijavi se sa Microsoft nalogom"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#1a1a2e" />
          ) : (
            <Text style={styles.microsoftBtnText}>Prijavi se sa Microsoft nalogom</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8f9fa' },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a2e', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 15,
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#e53935', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 13 },
  microsoftBtn: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  microsoftBtnText: { color: '#1a1a2e', fontSize: 16, fontWeight: '600' },
  disabledBtn: { opacity: 0.5 },
});
