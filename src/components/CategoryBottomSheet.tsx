import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { receiptsApi } from '../api/client';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';

interface Category {
  id: string;
  code: string;
  name: string;
}

interface Props {
  visible: boolean;
  currentCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onClose: () => void;
}

export function CategoryBottomSheet({ visible, currentCategoryId, onSelect, onClose }: Props) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && categories.length === 0) {
      setLoading(true);
      receiptsApi.getCategories()
        .then((res) => {
          const items = res.data?.data ?? res.data ?? [];
          setCategories(Array.isArray(items) ? items : []);
        })
        .catch(() => setCategories([]))
        .finally(() => setLoading(false));
    }
  }, [visible, categories.length]);

  const renderItem = ({ item }: { item: Category }) => {
    const isSelected = item.id === currentCategoryId;
    return (
      <TouchableOpacity
        style={[styles.item, isSelected && styles.itemSelected]}
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
          {item.name}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Kategorija</Text>

          {loading ? (
            <ActivityIndicator size="small" color={colors.brand} style={styles.loader} />
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
            />
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Zatvori</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 12,
      paddingBottom: 32,
      paddingHorizontal: 16,
      maxHeight: '60%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    list: {
      flexGrow: 0,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 4,
    },
    itemSelected: {
      backgroundColor: colors.surfacePressed,
    },
    itemText: {
      fontSize: 15,
      color: colors.text,
    },
    itemTextSelected: {
      fontWeight: '600',
    },
    loader: {
      paddingVertical: 24,
    },
    closeBtn: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 12,
    },
    closeBtnText: {
      fontSize: 15,
      color: colors.textMuted,
      fontWeight: '500',
    },
  });
}
