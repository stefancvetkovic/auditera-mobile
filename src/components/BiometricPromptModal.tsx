import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

export function BiometricPromptModal() {
  const { showBiometricPrompt, biometricInfo, setBiometricEnabled, dismissBiometricPrompt } =
    useAuthStore();
  const colors = useThemeStore((s) => s.colors);

  if (!showBiometricPrompt) return null;

  const biometryName =
    biometricInfo.biometryType === 'face-id' ? 'Face ID' : 'otisak prsta';

  const handleEnable = async () => {
    await setBiometricEnabled(true);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={dismissBiometricPrompt}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={dismissBiometricPrompt}
      >
        <View
          style={[styles.card, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.icon]}>
            {biometricInfo.biometryType === 'face-id' ? '👤' : '🔒'}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Brža prijava</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Želite li da koristite {biometryName} za prijavu sledeći put?
          </Text>

          <TouchableOpacity
            style={[styles.enableBtn, { backgroundColor: colors.brand }]}
            onPress={handleEnable}
            accessibilityRole="button"
          >
            <Text style={[styles.enableBtnText, { color: colors.brandText }]}>
              Uključi {biometryName}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={dismissBiometricPrompt}
            accessibilityRole="button"
          >
            <Text style={[styles.skipBtnText, { color: colors.textMuted }]}>Ne hvala</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  enableBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  enableBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipBtn: {
    padding: 8,
  },
  skipBtnText: {
    fontSize: 14,
  },
});
