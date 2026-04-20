import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, checkBiometricAvailability } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useMenuStore } from '../stores/menuStore';

export function MenuModal() {
  const { isOpen, close } = useMenuStore();
  const { user, logout, biometricEnabled, setBiometricEnabled } = useAuthStore();
  const { mode, colors, toggleTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrijska prijava');

  useEffect(() => {
    void checkBiometricAvailability().then((info) => {
      setBiometricAvailable(info.available);
      if (info.label) setBiometricLabel(info.label);
    });
  }, []);

  const initial = (user?.firstName ?? user?.email ?? '?')[0].toUpperCase();
  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email ?? '';

  const handleLogout = async () => {
    close();
    await logout();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent
      onRequestClose={close}
    >
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              paddingTop: insets.top + 16,
              borderBottomColor: colors.border,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* User Info */}
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
              <Text style={[styles.avatarText, { color: colors.brandText }]}>{initial}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Theme Toggle */}
          <View style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Tamni mod</Text>
            <Switch
              value={mode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor="#fff"
            />
          </View>

          {/* Biometric Toggle */}
          {biometricAvailable && (
            <View style={styles.menuRow}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{biometricLabel}</Text>
              <Switch
                value={biometricEnabled}
                onValueChange={(value) => void setBiometricEnabled(value)}
                trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                thumbColor="#fff"
              />
            </View>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Logout */}
          <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
            <Text style={[styles.menuLabel, { color: colors.error }]}>Odjavi se</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  panel: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuLabel: {
    fontSize: 16,
  },
});
