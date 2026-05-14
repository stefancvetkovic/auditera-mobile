import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Modal,
  PanResponder,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { receiptsApi } from '../api/client';
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
const HANDLE_SIZE = 28;
const MIN_CROP_PX = 60; // minimum crop dimension in image pixels

type CropBox = { left: number; top: number; right: number; bottom: number };
type ImageRect = { left: number; top: number; width: number; height: number; scale: number };

// ─── Crop Modal ──────────────────────────────────────────────────────────────

function CropModal({
  visible,
  imageUri,
  onClose,
  onApply,
}: {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onApply: (uri: string) => void;
}) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [applying, setApplying] = useState(false);

  // Refs for PanResponder (avoid stale closures)
  const cropBoxRef = useRef<CropBox | null>(null);
  const imageRectRef = useRef<ImageRect | null>(null);
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => { cropBoxRef.current = cropBox; }, [cropBox]);
  useEffect(() => { naturalSizeRef.current = naturalSize; }, [naturalSize]);

  // Reset when opened
  useEffect(() => {
    if (visible) {
      setNaturalSize(null);
      setContainerSize(null);
      setCropBox(null);
      cropBoxRef.current = null;
      imageRectRef.current = null;
      Image.getSize(imageUri, (w, h) => setNaturalSize({ width: w, height: h }));
    }
  }, [visible, imageUri]);

  // Derive displayed image rect (contain mode letterbox)
  const imageRect = useMemo((): ImageRect | null => {
    if (!naturalSize || !containerSize) return null;
    const scale = Math.min(
      containerSize.width / naturalSize.width,
      containerSize.height / naturalSize.height,
    );
    const displayedW = naturalSize.width * scale;
    const displayedH = naturalSize.height * scale;
    return {
      left: (containerSize.width - displayedW) / 2,
      top: (containerSize.height - displayedH) / 2,
      width: displayedW,
      height: displayedH,
      scale,
    };
  }, [naturalSize, containerSize]);

  useEffect(() => {
    imageRectRef.current = imageRect;
  }, [imageRect]);

  // Init crop box once image rect is known
  useEffect(() => {
    if (imageRect && naturalSize && !cropBoxRef.current) {
      const margin = 0.1;
      const box: CropBox = {
        left: naturalSize.width * margin,
        top: naturalSize.height * margin,
        right: naturalSize.width * (1 - margin),
        bottom: naturalSize.height * (1 - margin),
      };
      setCropBox(box);
      cropBoxRef.current = box;
    }
  }, [imageRect, naturalSize]);

  const makePanResponder = (corner: 'tl' | 'tr' | 'bl' | 'br') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const rect = imageRectRef.current;
        const ns = naturalSizeRef.current;
        const prev = cropBoxRef.current;
        if (!rect || !ns || !prev) return;

        // Screen → image coords
        const ix = Math.max(0, Math.min(ns.width, (g.moveX - rect.left) / rect.scale));
        const iy = Math.max(0, Math.min(ns.height, (g.moveY - rect.top) / rect.scale));

        const next = { ...prev };
        if (corner === 'tl' || corner === 'bl') next.left = Math.min(ix, prev.right - MIN_CROP_PX);
        if (corner === 'tr' || corner === 'br') next.right = Math.max(ix, prev.left + MIN_CROP_PX);
        if (corner === 'tl' || corner === 'tr') next.top = Math.min(iy, prev.bottom - MIN_CROP_PX);
        if (corner === 'bl' || corner === 'br') next.bottom = Math.max(iy, prev.top + MIN_CROP_PX);

        cropBoxRef.current = next;
        setCropBox({ ...next });
      },
    });

  const tlPan = useRef(makePanResponder('tl')).current;
  const trPan = useRef(makePanResponder('tr')).current;
  const blPan = useRef(makePanResponder('bl')).current;
  const brPan = useRef(makePanResponder('br')).current;

  const handleApply = async () => {
    const box = cropBoxRef.current;
    if (!box || applying) return;
    setApplying(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: Math.round(box.left),
            originY: Math.round(box.top),
            width: Math.round(box.right - box.left),
            height: Math.round(box.bottom - box.top),
          },
        }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onApply(result.uri);
    } finally {
      setApplying(false);
    }
  };

  // Screen coords of crop box
  const sc = cropBox && imageRect ? {
    left: imageRect.left + cropBox.left * imageRect.scale,
    top: imageRect.top + cropBox.top * imageRect.scale,
    right: imageRect.left + cropBox.right * imageRect.scale,
    bottom: imageRect.top + cropBox.bottom * imageRect.scale,
  } : null;

  const DIM = 'rgba(0,0,0,0.55)';

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent>
      <View style={cropStyles.root}>
        {/* Image container */}
        <View
          style={cropStyles.imgContainer}
          onLayout={(e) => setContainerSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })}
        >
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />

          {!sc && (
            <View style={cropStyles.loading}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}

          {sc && containerSize && (
            <>
              {/* 4 dimming strips around the crop window */}
              {/* Top */}
              <View style={[cropStyles.dim, { left: 0, top: 0, right: 0, height: sc.top }]} pointerEvents="none" />
              {/* Bottom */}
              <View style={[cropStyles.dim, { left: 0, top: sc.bottom, right: 0, bottom: 0 }]} pointerEvents="none" />
              {/* Left */}
              <View style={[cropStyles.dim, { left: 0, top: sc.top, width: sc.left, height: sc.bottom - sc.top }]} pointerEvents="none" />
              {/* Right */}
              <View style={[cropStyles.dim, { left: sc.right, top: sc.top, right: 0, height: sc.bottom - sc.top }]} pointerEvents="none" />

              {/* Crop border */}
              <View
                style={{
                  position: 'absolute',
                  left: sc.left,
                  top: sc.top,
                  width: sc.right - sc.left,
                  height: sc.bottom - sc.top,
                  borderWidth: 1.5,
                  borderColor: '#fff',
                }}
                pointerEvents="none"
              />

              {/* Grid lines (rule of thirds) */}
              <View style={{ position: 'absolute', left: sc.left + (sc.right - sc.left) / 3, top: sc.top, width: 1, height: sc.bottom - sc.top, backgroundColor: 'rgba(255,255,255,0.3)' }} pointerEvents="none" />
              <View style={{ position: 'absolute', left: sc.left + (sc.right - sc.left) * 2 / 3, top: sc.top, width: 1, height: sc.bottom - sc.top, backgroundColor: 'rgba(255,255,255,0.3)' }} pointerEvents="none" />
              <View style={{ position: 'absolute', left: sc.left, top: sc.top + (sc.bottom - sc.top) / 3, width: sc.right - sc.left, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} pointerEvents="none" />
              <View style={{ position: 'absolute', left: sc.left, top: sc.top + (sc.bottom - sc.top) * 2 / 3, width: sc.right - sc.left, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} pointerEvents="none" />

              {/* Corner handles */}
              {([
                { pan: tlPan, left: sc.left - HANDLE_SIZE / 2, top: sc.top - HANDLE_SIZE / 2 },
                { pan: trPan, left: sc.right - HANDLE_SIZE / 2, top: sc.top - HANDLE_SIZE / 2 },
                { pan: blPan, left: sc.left - HANDLE_SIZE / 2, top: sc.bottom - HANDLE_SIZE / 2 },
                { pan: brPan, left: sc.right - HANDLE_SIZE / 2, top: sc.bottom - HANDLE_SIZE / 2 },
              ] as const).map(({ pan, left, top }, i) => (
                <View
                  key={i}
                  {...pan.panHandlers}
                  style={[cropStyles.handle, { left, top }]}
                />
              ))}
            </>
          )}
        </View>

        {/* Bottom bar */}
        <View style={cropStyles.bar}>
          <TouchableOpacity style={cropStyles.cancelBtn} onPress={onClose}>
            <Text style={cropStyles.cancelText}>Otkaži</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cropStyles.applyBtn, applying && { opacity: 0.6 }]}
            onPress={() => void handleApply()}
            disabled={applying || !sc}
          >
            {applying
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={cropStyles.applyText}>Apliciraj crop</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cropStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  imgContainer: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  bar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#111',
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  applyBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  applyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Preview Screen ───────────────────────────────────────────────────────────

export function PreviewScreen({ navigation, route }: Props) {
  const [imageUri, setImageUri] = useState(route.params.imageUri);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [cropVisible, setCropVisible] = useState(false);
  const submitting = useRef(false);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const costCenters = getCachedCostCenters();
  const [attributionType, setAttributionType] = useState<'employee' | 'costCenter'>(
    costCenters.length > 0 ? 'costCenter' : 'employee',
  );
  const defaultCostCenterId = costCenters.length === 1
    ? costCenters[0].id
    : getLastUsedCostCenterId();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(defaultCostCenterId);

  const handleRotate = async (degrees: 90 | -90) => {
    if (rotating || loading) return;
    setRotating(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ rotate: degrees }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      setImageUri(result.uri);
    } finally {
      setRotating(false);
    }
  };

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
      if (description.trim()) formData.append('description', description.trim());
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Pregled računa</Text>

        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />

        {/* Image tools: rotate + crop */}
        <View style={styles.toolRow}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => void handleRotate(-90)}
            disabled={rotating || loading}
            accessibilityLabel="Rotiraj levo"
            accessibilityRole="button"
          >
            {rotating
              ? <ActivityIndicator size="small" color={colors.brand} />
              : <Text style={styles.toolBtnText}>↺</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => void handleRotate(90)}
            disabled={rotating || loading}
            accessibilityLabel="Rotiraj desno"
            accessibilityRole="button"
          >
            {rotating
              ? <ActivityIndicator size="small" color={colors.brand} />
              : <Text style={styles.toolBtnText}>↻</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setCropVisible(true)}
            disabled={rotating || loading}
            accessibilityLabel="Crop slike"
            accessibilityRole="button"
          >
            <Text style={styles.toolBtnText}>⊡</Text>
          </TouchableOpacity>
        </View>

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

        {costCenters.length > 0 && (
          <View style={styles.attributionSection}>
            <Text style={[styles.label, { color: colors.text }]}>Dodeli na:</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, attributionType === 'employee' && styles.toggleBtnActive]}
                onPress={() => setAttributionType('employee')}
              >
                <Text style={[styles.toggleBtnText, { color: colors.text }]}>Zaposleni</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, attributionType === 'costCenter' && styles.toggleBtnActive]}
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
                    style={[styles.ccOption, selectedCostCenterId === cc.id && styles.ccOptionSelected]}
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
            onPress={() => void handleSend()}
            disabled={loading}
            accessibilityLabel="Pošalji račun"
            accessibilityRole="button"
          >
            {loading
              ? <ActivityIndicator color={colors.brandText} />
              : <Text style={styles.primaryBtnText}>Pošalji</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CropModal
        visible={cropVisible}
        imageUri={imageUri}
        onClose={() => setCropVisible(false)}
        onApply={(uri) => {
          setImageUri(uri);
          setCropVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
    preview: { width: '100%', height: 300, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 16 },
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
    toolRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 20,
    },
    toolBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toolBtnText: { fontSize: 22, color: colors.text },
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
    toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    toggleBtn: {
      flex: 1,
      padding: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    toggleBtnActive: { borderColor: colors.brand, backgroundColor: colors.surfacePressed },
    toggleBtnText: { fontSize: 14, fontWeight: '500' },
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
