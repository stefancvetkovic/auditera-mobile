import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { receiptsApi, arrayBufferToBase64 } from '../api/client';
import type { FiscalReceiptData } from '../api/client';
import { cacheReceiptImage, getCachedReceiptImage } from '../stores/receiptsCache';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptDetail'>;

export function ReceiptDetailScreen({ route }: Props) {
  const { receiptId, fileName, description, period, isFiscal } = route.params;
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Image query — only for non-fiscal receipts
  const { data: imageUri, isLoading, isError, error } = useQuery({
    queryKey: ['receiptImage', receiptId],
    queryFn: async () => {
      const cached = await getCachedReceiptImage(receiptId);

      try {
        const response = await receiptsApi.downloadReceiptImage(receiptId);
        const base64 = arrayBufferToBase64(response.data);
        const uri = `data:image/jpeg;base64,${base64}`;
        void cacheReceiptImage(receiptId, uri);
        return uri;
      } catch (e: unknown) {
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
    enabled: !isFiscal,
  });

  // Details query — only for fiscal receipts (fetches journal text)
  const { data: details, refetch: refetchDetails } = useQuery({
    queryKey: ['receiptDetails', receiptId],
    queryFn: () => receiptsApi.getReceiptDetails(receiptId).then((r) => r.data.data),
    enabled: isFiscal,
    staleTime: 5 * 60 * 1000,
  });

  const journal = useMemo(() => {
    if (!details?.fiscalData) return null;
    try {
      const fd = JSON.parse(details.fiscalData) as Record<string, unknown>;
      // Podrži stare zapise (PascalCase) i nove (camelCase)
      const value = fd['journal'] ?? fd['Journal'];
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }, [details?.fiscalData]);

  // Refetch fiscal data from PURS
  const { mutate: triggerRefetch, isPending: isRefetching } = useMutation({
    mutationFn: () => receiptsApi.refetchFiscalData(receiptId),
    onSuccess: () => void refetchDetails(),
  });

  return (
    <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.content}>
      {/* Image loading/error — only for non-fiscal */}
      {!isFiscal && isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Učitavanje slike...</Text>
        </View>
      )}

      {!isFiscal && isError && (
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

      {/* Fiscal journal section */}
      {isFiscal && (
        <View style={styles.journalSection}>
          <View style={styles.journalBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#92400e" />
            <Text style={styles.journalBannerText}>
              Žurnal se pojavljuje 15–20 minuta nakon plaćanja
            </Text>
          </View>

          <View style={styles.journalToolbar}>
            <Text style={styles.journalTitle}>Fiskalni žurnal</Text>
            <TouchableOpacity
              onPress={() => triggerRefetch()}
              style={styles.refreshBtn}
              disabled={isRefetching}
              accessibilityLabel="Osveži žurnal"
              accessibilityRole="button"
            >
              {isRefetching ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.brand} />
              )}
              <Text style={styles.refreshBtnText}>Osveži</Text>
            </TouchableOpacity>
          </View>

          {journal ? (
            <ScrollView
              style={styles.journalScroll}
              contentContainerStyle={styles.journalScrollContent}
            >
              <Text style={styles.journalText}>{journal}</Text>
            </ScrollView>
          ) : (
            <View style={styles.journalEmpty}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.journalEmptyText}>
                Žurnal još nije dostupan.{'\n'}Pritisnite "Osveži" da pokušate ponovo.
              </Text>
            </View>
          )}
        </View>
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
    </View>
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
    journalSection: {
      marginBottom: 16,
    },
    journalBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fef3c7',
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
    },
    journalBannerText: {
      flex: 1,
      fontSize: 12,
      color: '#92400e',
      lineHeight: 16,
    },
    journalToolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    journalTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    refreshBtnText: {
      fontSize: 13,
      color: colors.brand,
      fontWeight: '600',
    },
    journalScroll: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 400,
    },
    journalScrollContent: {
      padding: 12,
    },
    journalText: {
      fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
      fontSize: 11,
      lineHeight: 16,
      color: colors.text,
    },
    journalEmpty: {
      alignItems: 'center',
      paddingVertical: 32,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    journalEmptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
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
