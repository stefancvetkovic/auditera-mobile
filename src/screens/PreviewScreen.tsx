import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { receiptsApi, getApiErrorMessage } from '../api/client';
import { savePendingReceipt } from '../stores/receiptsCache';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Preview'>;
  route: RouteProp<RootStackParamList, 'Preview'>;
};

const SUBMISSION_SOURCE_MOBILE = '0';

export function PreviewScreen({ navigation, route }: Props) {
  const { imageUri, qrUrl } = route.params;
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSend = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      } as unknown as Blob);
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (qrUrl) {
        formData.append('fiscalQrUrl', qrUrl);
      }
      formData.append('submittedVia', SUBMISSION_SOURCE_MOBILE);

      await receiptsApi.submit(formData);
      navigation.navigate('Main');
    } catch (e: unknown) {
      // Save locally when API is unreachable
      await savePendingReceipt({
        localId: Date.now().toString(),
        imageUri,
        description: description.trim(),
        qrUrl,
        savedAt: new Date().toISOString(),
      });
      Alert.alert(
        'Sačuvano lokalno',
        'Račun je sačuvan na uređaju i biće poslat kada se uspostavi konekcija.',
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }],
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Pregled računa</Text>

      <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />

      {qrUrl ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Fiskalni QR detektovan</Text>
        </View>
      ) : (
        <View style={[styles.badge, styles.badgeGray]}>
          <Text style={styles.badgeText}>Obični račun</Text>
        </View>
      )}

      <Text style={styles.label}>Opis (opciono)</Text>
      <TextInput
        style={styles.input}
        placeholder="Npr. poslovni ručak, gorivo..."
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        editable={!loading}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
          accessibilityLabel="Ponovi slikanje"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>Ponovi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.disabled]}
          onPress={handleSend}
          disabled={loading}
          accessibilityLabel="Pošalji račun"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.brandText} />
          ) : (
            <Text style={styles.primaryBtnText}>Pošalji</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
    preview: { width: '100%', height: 300, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 12 },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.badgeFiscalBg,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 16,
    },
    badgeGray: { backgroundColor: colors.badgeImageBg },
    badgeText: { color: colors.badgeFiscalText, fontSize: 12, fontWeight: '600' },
    label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
    input: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.inputText,
      textAlignVertical: 'top',
      marginBottom: 24,
    },
    actions: { flexDirection: 'row', gap: 12 },
    primaryBtn: {
      flex: 1,
      backgroundColor: colors.brand,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.brandText, fontSize: 16, fontWeight: '600' },
    secondaryBtn: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    disabled: { opacity: 0.6 },
  });
}
