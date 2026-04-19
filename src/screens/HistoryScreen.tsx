import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { receiptsApi } from '../api/client';

interface ReceiptItem {
  id: string;
  sequenceNumber: number;
  fileName: string;
  description: string | null;
  period: string;
  isFiscal: boolean;
  submittedAt: string;
}

interface ReceiptsResponse {
  data: {
    items: ReceiptItem[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
  };
}

export function HistoryScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ReceiptsResponse>({
    queryKey: ['myReceipts'],
    queryFn: () => receiptsApi.getMyReceipts(1).then((r) => r.data),
  });

  const items = data?.data?.items ?? [];

  const renderItem = useCallback(({ item }: { item: ReceiptItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.seq}>#{item.sequenceNumber.toString().padStart(3, '0')}</Text>
        <View style={[styles.badge, item.isFiscal ? styles.badgeFiscal : styles.badgeImage]}>
          <Text style={styles.badgeText}>{item.isFiscal ? 'Fiskalni' : 'Slika'}</Text>
        </View>
      </View>
      <Text style={styles.fileName}>{item.fileName}</Text>
      {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
      <Text style={styles.meta}>{item.period} · {new Date(item.submittedAt).toLocaleDateString('sr-RS')}</Text>
    </View>
  ), []);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>;
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Greška pri učitavanju računa.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>Nema poslatih računa.</Text>
        </View>
      }
      contentContainerStyle={items.length === 0 ? styles.flex : styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { flex: 1, backgroundColor: '#f8f9fa' },
  listContent: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  seq: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeFiscal: { backgroundColor: '#e8f5e9' },
  badgeImage: { backgroundColor: '#e3f2fd' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#333' },
  fileName: { fontSize: 13, color: '#555', marginBottom: 4 },
  desc: { fontSize: 13, color: '#333', marginBottom: 4 },
  meta: { fontSize: 11, color: '#999' },
  emptyText: { fontSize: 15, color: '#999' },
  errorText: { fontSize: 15, color: '#e53935' },
});
