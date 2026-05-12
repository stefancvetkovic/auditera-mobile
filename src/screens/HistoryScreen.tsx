import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { isAxiosError } from 'axios';
import { receiptsApi } from '../api/client';
import { cacheReceipts, getCachedReceipts, getCachedCostCenters, getPendingReceipts, removePendingReceipt } from '../stores/receiptsCache';
import type { PendingReceipt } from '../stores/receiptsCache';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { CategoryBottomSheet } from '../components/CategoryBottomSheet';

interface ReceiptItem {
  id: string;
  sequenceNumber: number;
  fileName: string;
  description: string | null;
  period: string;
  isFiscal: boolean;
  submittedAt: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  aiConfidence: number | null;
  fiscalQrUrl: string | null;
  costCenterId?: string;
  costCenterName?: string;
}

interface ReceiptsApiBody {
  isSuccess: boolean;
  data: {
    items: ReceiptItem[];
    totalCount: number;
    pageNumber: number;
    totalPages: number;
  };
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cachedItems, setCachedItems] = useState<ReceiptItem[] | null>(null);
  const costCenters = getCachedCostCenters();
  const [filterCostCenterId, setFilterCostCenterId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReceipt[]>([]);
  const [categorySheet, setCategorySheet] = useState<{ visible: boolean; receiptId: string | null; currentCategoryId: string | null }>({
    visible: false, receiptId: null, currentCategoryId: null,
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ReceiptsApiBody>({
    queryKey: ['myReceipts'],
    queryFn: () => receiptsApi.getMyReceipts(1).then((r) => r.data),
  });

  const serverItems = data?.data?.items ?? [];

  // Cache receipts on successful fetch + try syncing pending
  useEffect(() => {
    if (serverItems.length > 0) {
      void cacheReceipts(serverItems);
    }
    // Sync pending receipts when server is reachable
    if (data && pending.length > 0) {
      void syncPendingReceipts();
    }
  }, [serverItems]);

  const syncPendingReceipts = async () => {
    const current = await getPendingReceipts();
    for (const p of current) {
      try {
        // Check if the image file still exists (temp files get cleaned up between app launches)
        const fileInfo = await FileSystem.getInfoAsync(p.imageUri);
        if (!fileInfo.exists) {
          // File is gone — remove from queue, can't recover
          await removePendingReceipt(p.localId);
          continue;
        }

        const formData = new FormData();
        formData.append('image', {
          uri: p.imageUri,
          type: 'image/jpeg',
          name: 'receipt.jpg',
        } as unknown as Blob);
        if (p.description) formData.append('description', p.description);
        formData.append('submittedVia', '0');
        await receiptsApi.submit(formData);
        await removePendingReceipt(p.localId);
      } catch (e: unknown) {
        // Only break if it's a network error (still offline)
        if (isAxiosError(e) && !e.response) break;
        // For other errors (4xx, 5xx), remove the receipt and continue
        await removePendingReceipt(p.localId);
      }
    }
    const remaining = await getPendingReceipts();
    setPending(remaining);
    if (remaining.length < current.length) {
      void refetch();
    }
  };

  // Load cached receipts + pending on mount
  useEffect(() => {
    void getCachedReceipts().then((cached) => {
      if (cached) setCachedItems(cached);
    });
    void getPendingReceipts().then(setPending);
  }, []);

  // Refetch when tab gains focus (e.g. after submitting a receipt on Camera tab)
  useEffect(() => {
    if (isFocused) {
      void refetch();
      void getPendingReceipts().then(setPending);
    }
  }, [isFocused, refetch]);

  const isOffline = isError && !isLoading;
  const items = isOffline ? (cachedItems ?? []) : serverItems;
  const filteredItems = filterCostCenterId
    ? items.filter((r) => r.costCenterId === filterCostCenterId)
    : items;

  const handlePress = useCallback((item: ReceiptItem) => {
    navigation.navigate('ReceiptDetail', {
      receiptId: item.id,
      fileName: item.fileName,
      description: item.description,
      period: item.period,
      isFiscal: item.isFiscal,
    });
  }, [navigation]);

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    const receiptId = categorySheet.receiptId;
    if (!receiptId) return;
    setCategorySheet({ visible: false, receiptId: null, currentCategoryId: null });
    try {
      await receiptsApi.updateCategory(receiptId, categoryId);
      void queryClient.invalidateQueries({ queryKey: ['myReceipts'] });
    } catch {
      // silent fail — user can retry
    }
  }, [categorySheet.receiptId, queryClient]);

  const renderItem = useCallback(({ item }: { item: ReceiptItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handlePress(item)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.seq}>#{item.sequenceNumber.toString().padStart(3, '0')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.badge, item.isFiscal ? styles.badgeFiscal : styles.badgeImage]}>
            <Text style={[styles.badgeText, { color: item.isFiscal ? colors.badgeFiscalText : colors.badgeImageText }]}>
              {item.isFiscal ? 'Fiskalni' : 'Slika'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
      <Text style={styles.fileName} numberOfLines={1}>{item.fileName}</Text>
      <Text style={{ color: colors.textSecondary }}>
        {item.costCenterName ? `CC: ${item.costCenterName}` : (item.description ?? '')}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.meta}>{item.period} · {new Date(item.submittedAt).toLocaleDateString('sr-RS')}</Text>
        {item.suggestedCategoryName ? (
          <TouchableOpacity
            style={[styles.badge, styles.badgeCategory]}
            onPress={(e) => {
              e.stopPropagation();
              setCategorySheet({ visible: true, receiptId: item.id, currentCategoryId: item.suggestedCategoryId });
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.badgeText, { color: colors.badgeCategoryText }]}>
              {item.suggestedCategoryName}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  ), [styles, colors, handlePress]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }

  // Only show full error screen if offline AND no cached data
  if (isOffline && items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={styles.offlineTitle}>Nema keširanog sadržaja</Text>
        <Text style={styles.offlineSubtitle}>Konekcija ka serveru trenutno nije moguća.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryBtnText}>Pokušaj ponovo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingHeader = pending.length > 0 ? (
    <View style={styles.pendingSection}>
      <View style={styles.pendingHeader}>
        <Ionicons name="time-outline" size={16} color={colors.textMuted} />
        <Text style={styles.pendingTitle}>Čeka slanje ({pending.length})</Text>
      </View>
      {pending.map((p) => (
        <View key={p.localId} style={[styles.card, styles.pendingCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.seq}>Na čekanju</Text>
            <View style={[styles.badge, styles.badgeImage]}>
              <Text style={[styles.badgeText, { color: colors.badgeImageText }]}>
                Slika
              </Text>
            </View>
          </View>
          {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
          <Text style={styles.meta}>{new Date(p.savedAt).toLocaleDateString('sr-RS')}</Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View style={styles.flex}>
      {costCenters.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterCostCenterId === null && styles.filterChipActive,
            ]}
            onPress={() => setFilterCostCenterId(null)}
          >
            <Text style={{ color: filterCostCenterId === null ? colors.brand : colors.text }}>Svi</Text>
          </TouchableOpacity>
          {costCenters.map((cc) => (
            <TouchableOpacity
              key={cc.id}
              style={[
                styles.filterChip,
                filterCostCenterId === cc.id && styles.filterChipActive,
              ]}
              onPress={() => setFilterCostCenterId(cc.id)}
            >
              <Text style={{ color: filterCostCenterId === cc.id ? colors.brand : colors.text }}>{cc.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <FlatList
        style={styles.list}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={pendingHeader}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void refetch();
              void getPendingReceipts().then(setPending);
            }}
            tintColor={colors.brand}
          />
        }
        ListEmptyComponent={
          pending.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nema poslatih računa.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={filteredItems.length === 0 && pending.length === 0 ? styles.flexGrow : styles.listContent}
      />
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.brandText} />
          <Text style={styles.offlineBannerText}>Konekcija ka serveru trenutno nije moguća</Text>
        </View>
      )}
      <CategoryBottomSheet
        visible={categorySheet.visible}
        currentCategoryId={categorySheet.currentCategoryId}
        onSelect={handleCategorySelect}
        onClose={() => setCategorySheet({ visible: false, receiptId: null, currentCategoryId: null })}
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    flexGrow: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    list: { flex: 1, backgroundColor: colors.background },
    listContent: { padding: 16, gap: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    seq: { fontSize: 15, fontWeight: '700', color: colors.text },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeFiscal: { backgroundColor: colors.badgeFiscalBg },
    badgeImage: { backgroundColor: colors.badgeImageBg },
    badgeText: { fontSize: 11, fontWeight: '600' },
    badgeCategory: { backgroundColor: colors.badgeCategoryBg },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    fileName: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
    desc: { fontSize: 13, color: colors.text, marginBottom: 4 },
    meta: { fontSize: 11, color: colors.textMuted },
    emptyContainer: { alignItems: 'center', padding: 24 },
    emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 12 },
    pendingSection: { marginBottom: 8 },
    pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    pendingTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    pendingCard: { borderStyle: 'dashed' as const, opacity: 0.8, marginBottom: 8 },
    offlineTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 },
    offlineSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
    retryBtn: {
      marginTop: 16,
      backgroundColor: colors.brand,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryBtnText: { color: colors.brandText, fontSize: 14, fontWeight: '600' },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.error,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    offlineBannerText: {
      color: colors.brandText,
      fontSize: 12,
      fontWeight: '500',
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 6,
    },
    filterChipActive: { borderColor: colors.brand },
  });
}
