import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { receiptsApi, arrayBufferToBase64 } from '../api/client';
import { cacheReceiptImage, getCachedReceiptImage } from '../stores/receiptsCache';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptDetail'>;

export function ReceiptDetailScreen({ route }: Props) {
  const { receiptId, fileName, description, period, isFiscal } = route.params;
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: imageUri, isLoading, isError, error } = useQuery({
    queryKey: ['receiptImage', receiptId],
    queryFn: async () => {
      // Try cached image first
      const cached = await getCachedReceiptImage(receiptId);

      try {
        const response = await receiptsApi.downloadReceiptImage(receiptId);
        const base64 = arrayBufferToBase64(response.data);
        const uri = `data:image/jpeg;base64,${base64}`;
        void cacheReceiptImage(receiptId, uri);
        return uri;
      } catch (e: unknown) {
        // API failed — return cache if available
        if (cached) return cached;
        let msg = 'Unknown error';
        if (axios.isAxiosError(e)) {
          const data = e.response?.data;
          msg = `${e.response?.status}: ${typeof data === 'object' && data ? JSON.stringify(data) : e.message}`;
        } else if (e instanceof Error) {
          msg = e.message;
        }
        throw new Error(msg);
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Učitavanje slike...</Text>
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Slika nije dostupna'}
          </Text>
        </View>
      )}

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Naziv fajla</Text>
        <Text style={styles.value}>{fileName}</Text>

        {description ? (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>Opis</Text>
            <Text style={styles.value}>{description}</Text>
          </>
        ) : null}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Period</Text>
            <Text style={styles.value}>{period}</Text>
          </View>
          <View style={[styles.badge, isFiscal ? styles.badgeFiscal : styles.badgeImage]}>
            <Text style={[styles.badgeText, { color: isFiscal ? colors.badgeFiscalText : colors.badgeImageText }]}>
              {isFiscal ? 'Fiskalni' : 'Slika'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
    },
    center: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      color: colors.textMuted,
      marginTop: 12,
      fontSize: 14,
    },
    errorText: {
      color: colors.textMuted,
      fontSize: 15,
      marginTop: 12,
    },
    image: {
      width: '100%',
      height: 400,
      borderRadius: 10,
      marginBottom: 16,
      backgroundColor: colors.surface,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    value: {
      color: colors.text,
      fontSize: 14,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeFiscal: {
      backgroundColor: colors.badgeFiscalBg,
    },
    badgeImage: {
      backgroundColor: colors.badgeImageBg,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
