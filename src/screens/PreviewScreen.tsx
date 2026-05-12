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
import { isAxiosError } from 'axios';
import { receiptsApi, getApiErrorMessage } from '../api/client';
import { savePendingReceipt, getCachedCostCenters, getLastUsedCostCenterId, setLastUsedCostCenterId } from '../stores/receiptsCache';
import type { CostCenterSummaryDto } from '../types/costCenters';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Preview'>;
  route: RouteProp<RootStackParamList, 'Preview'>;
};

const SUBMISSION_SOURCE_MOBILE = '0';

export function PreviewScreen({ navigation, route }: Props) {
  const { imageUri } = route.params;
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = React.useRef(false);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const costCenters = getCachedCostCenters();
  const [attributionType, setAttributionType] = useState<'employee' | 'costCenter'>(
    costCenters.length > 0 ? 'costCenter' : 'employee'
  );
  const defaultCostCenterId = costCenters.length === 1
    ? costCenters[0].id
    : getLastUsedCostCenterId();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(defaultCostCenterId);

  const handleSend = async () => {
    if (submitting.current) return;
    submitting.current = true;
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
      formData.append('submittedVia', SUBMISSION_SOURCE_MOBILE);
      if (attributionType === 'costCenter' && selectedCostCenterId) {
        formData.append('costCenterId', selectedCostCenterId);
        setLastUsedCostCenterId(selectedCostCenterId);
      }

      await receiptsApi.submit(formData);
      navigation.navigate('Main');
    } catch (e: unknown) {
      const isNetworkError = isAxiosError(e) && !e.response;
      if (isNetworkError) {
        await savePendingReceipt({
          localId: Date.now().toString(),
          imageUri,
          description: description.trim(),
          savedAt: new Date().toISOString(),
        });
        Alert.alert(
          'Sačuvano lokalno',
          'Račun je sačuvan na uređaju i biće poslat kada se uspostavi konekcija.',
          [{ text: 'OK', onPress: () => navigation.navigate('Main') }],
        );
      } else {
        const detail = isAxiosError(e)
          ? `Status: ${e.response?.status}\n\n${JSON.stringify(e.response?.data, null, 2)}`
          : String(e);
        Alert.alert('Greška pri slanju', detail);
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Pregled računa</Text>

      <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />

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

      {/* Attribution — only when cost centers are available */}
      {costCenters.length > 0 && (
        <View style={styles.attributionSection}>
          <Text style={[styles.label, { color: colors.text }]}>Dodeli na:</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                attributionType === 'employee' && styles.toggleBtnActive,
              ]}
              onPress={() => setAttributionType('employee')}
            >
              <Text style={[styles.toggleBtnText, { color: colors.text }]}>Zaposleni</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                attributionType === 'costCenter' && styles.toggleBtnActive,
              ]}
              onPress={() => setAttributionType('costCenter')}
            >
              <Text style={[styles.toggleBtnText, { color: colors.text }]}>Troškovni centar</Text>
            </TouchableOpacity>
          </View>
          {attributionType === 'costCenter' && (
            <View style={styles.pickerContainer}>
              {costCenters.map((cc: CostCenterSummaryDto) => (
                <TouchableOpacity
                  key={cc.id}
                  style={[
                    styles.ccOption,
                    selectedCostCenterId === cc.id && styles.ccOptionSelected,
                  ]}
                  onPress={() => setSelectedCostCenterId(cc.id)}
                >
                  <Text style={{ color: colors.text }}>{cc.code} — {cc.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

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
    preview: { width: '100%', height: 300, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 20 },
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
    attributionSection: { marginVertical: 8 },
    toggleRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 8 },
    toggleBtn: {
      flex: 1,
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center' as const,
    },
    toggleBtnActive: { borderColor: colors.brand, backgroundColor: colors.surfacePressed },
    toggleBtnText: { fontSize: 14, fontWeight: '500' as const },
    pickerContainer: { gap: 4 },
    ccOption: {
      padding: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ccOptionSelected: { borderColor: colors.brand, backgroundColor: colors.surfacePressed },
  });
}
