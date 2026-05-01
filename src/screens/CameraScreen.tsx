import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
  Modal,
  Animated as RNAnimated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { receiptsApi } from '../api/client';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { parseFiscalQr, type FiscalQrData } from '../utils/parseFiscalQr';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'>;
};

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year}. ${hours}:${minutes}`;
}

function ScanLine({ size }: { size: number }) {
  const translateY = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(translateY, {
          toValue: size - 4,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(translateY, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [translateY, size]);

  return (
    <RNAnimated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 8,
        right: 8,
        height: 2,
        backgroundColor: '#22c55e',
        opacity: 0.8,
        transform: [{ translateY }],
      }}
    />
  );
}

export function CameraScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [scannedData, setScannedData] = useState<{
    qrValue: string;
    fiscal: FiscalQrData | null;
  } | null>(null);
  const [description, setDescription] = useState('');
  const cameraRef = useRef<Camera>(null);
  const qrDetectedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // Reset state when screen gains focus
  useEffect(() => {
    if (isFocused) {
      qrDetectedRef.current = false;
      setIsSubmitting(false);
      setShowBanner(false);
      setScannedData(null);
      setDescription('');
    }
  }, [isFocused]);

  const showSuccessBanner = useCallback(() => {
    setShowBanner(true);
    const timer = setTimeout(() => {
      setShowBanner(false);
      navigation.navigate('Main');
    }, 1500);
    return timer;
  }, [navigation]);

  // Stable refs so codeScanner callback never changes identity
  const queryClientRef = useRef(queryClient);
  const showBannerFnRef = useRef(showSuccessBanner);
  useEffect(() => {
    showBannerFnRef.current = showSuccessBanner;
  }, [showSuccessBanner]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      (codes) => {
        if (codes.length === 0 || qrDetectedRef.current || isSubmittingRef.current) return;
        const qrValue = codes[0].value;
        if (!qrValue) return;

        // Validacija: samo PURS fiskalni QR kodovi
        if (!qrValue.includes('suf.purs.gov.rs')) {
          qrDetectedRef.current = true;
          Vibration.vibrate(50);
          Alert.alert(
            'Nepoznat QR kod',
            'Ovaj QR kod nije QR kod fiskalnog računa.',
            [{ text: 'U redu', onPress: () => { qrDetectedRef.current = false; } }],
          );
          return;
        }

        qrDetectedRef.current = true;
        Vibration.vibrate(100);

        const fiscal = parseFiscalQr(qrValue);
        setScannedData({ qrValue, fiscal });
      },
      [],
    ),
  });

  const handleCancel = useCallback(() => {
    setScannedData(null);
    setDescription('');
    qrDetectedRef.current = false;
  }, []);

  const handleSubmit = useCallback(() => {
    if (!scannedData) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    const desc = description.trim() || undefined;

    receiptsApi
      .submitFiscal(scannedData.qrValue, desc)
      .then(() => {
        setScannedData(null);
        setDescription('');
        void queryClientRef.current.invalidateQueries({ queryKey: ['myReceipts'] });
        showBannerFnRef.current();
      })
      .catch((e: unknown) => {
        let detail: string;
        if (isAxiosError(e)) {
          detail = e.response
            ? `Status: ${e.response.status}\n\n${JSON.stringify(e.response.data, null, 2)}`
            : `Network error: ${e.message}\n\nCode: ${e.code}`;
        } else {
          detail = e instanceof Error ? e.message : String(e);
        }
        Alert.alert('Greška pri slanju', detail);
        qrDetectedRef.current = false;
      })
      .finally(() => {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      });
  }, [scannedData, description]);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto();
      if (photo) {
        navigation.navigate('Preview', { imageUri: `file://${photo.path}` });
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće napraviti fotografiju.');
    } finally {
      setCapturing(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Potrebna je dozvola za kameru.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Daj dozvolu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Success overlay */}
      {showBanner && (
        <View style={styles.successOverlay}>
          <View style={styles.successCircle}>
            <Text style={styles.successCheck}>✓</Text>
          </View>
          <Text style={styles.successText}>Račun uspešno poslat</Text>
        </View>
      )}

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && !showBanner}
        photo={true}
        codeScanner={codeScanner}
        fps={30}
        pixelFormat="yuv"
        videoStabilizationMode="off"
      />

      <View style={styles.overlay}>
        {/* QR scan guide reticle */}
        <View style={styles.reticleContainer}>
          <ScanLine size={RETICLE_SIZE} />
          <View style={[styles.reticleCorner, styles.reticleTopLeft]} />
          <View style={[styles.reticleCorner, styles.reticleTopRight]} />
          <View style={[styles.reticleCorner, styles.reticleBottomLeft]} />
          <View style={[styles.reticleCorner, styles.reticleBottomRight]} />
          <Text style={styles.reticleHint}>{'Skeniraj QR kod\nili slikaj račun'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.shutter, (capturing || isSubmitting) && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={capturing || isSubmitting}
          accessibilityLabel="Slikaj račun"
          accessibilityRole="button"
        >
          {capturing || isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>
      </View>

      {/* Fiscal QR modal */}
      <Modal visible={scannedData !== null} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fiskalni račun</Text>

            {scannedData?.fiscal && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalAmount}>
                  {scannedData.fiscal.totalAmount.toLocaleString('sr-RS', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  RSD
                </Text>
                <Text style={styles.modalDate}>
                  {formatDate(scannedData.fiscal.dateTime)}
                </Text>
                <Text style={styles.modalType}>
                  {scannedData.fiscal.transactionType}
                </Text>
              </View>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Opis (opciono)"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              autoFocus
              returnKeyType="done"
            />

            {scannedData?.qrValue && (
              <TouchableOpacity
                style={styles.modalBtnJournal}
                onPress={() => void Linking.openURL(scannedData.qrValue)}
              >
                <Text style={styles.modalBtnJournalText}>Pogledaj žurnal na PURS portalu</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.modalBtnCancel}
                disabled={isSubmitting}
              >
                <Text style={styles.modalBtnCancelText}>Otkaži</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.modalBtnSubmit, isSubmitting && { opacity: 0.6 }]}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Pošalji</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const RETICLE_SIZE = 200;
const CORNER_LENGTH = 32;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = '#fff';

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    permText: { fontSize: 16, textAlign: 'center', marginBottom: 16, color: colors.text },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 80,
      paddingBottom: 48,
    },
    // Success overlay
    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    successCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#22c55e',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    successCheck: {
      color: '#fff',
      fontSize: 40,
      fontWeight: '700',
    },
    successText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
    },
    // Reticle
    reticleContainer: {
      width: RETICLE_SIZE,
      height: RETICLE_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
    },
    reticleCorner: {
      position: 'absolute',
      width: CORNER_LENGTH,
      height: CORNER_LENGTH,
      borderColor: CORNER_COLOR,
    },
    reticleTopLeft: {
      top: 0,
      left: 0,
      borderTopWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderTopLeftRadius: 4,
    },
    reticleTopRight: {
      top: 0,
      right: 0,
      borderTopWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderTopRightRadius: 4,
    },
    reticleBottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderBottomLeftRadius: 4,
    },
    reticleBottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderBottomRightRadius: 4,
    },
    reticleHint: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      textAlign: 'center',
      paddingHorizontal: 8,
      lineHeight: 18,
    },
    // Shutter
    shutter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderWidth: 4,
      borderColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    shutterDisabled: { opacity: 0.5 },
    shutterInner: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#fff',
    },
    btn: { backgroundColor: colors.brand, padding: 14, borderRadius: 8 },
    btnText: { color: colors.brandText, fontSize: 15 },
    // Modal
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      width: '85%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 24,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    modalInfo: {
      backgroundColor: colors.badgeFiscalBg,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    modalAmount: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
    },
    modalDate: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    modalType: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: 16,
    },
    modalBtnJournal: {
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.brand,
      alignItems: 'center',
      marginBottom: 12,
    },
    modalBtnJournalText: {
      fontSize: 13,
      color: colors.brand,
      fontWeight: '600',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    modalBtnCancel: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    modalBtnCancelText: {
      fontSize: 15,
      color: colors.textMuted,
      fontWeight: '600',
    },
    modalBtnSubmit: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: '#22c55e',
      alignItems: 'center',
    },
    modalBtnSubmitText: {
      fontSize: 15,
      color: '#fff',
      fontWeight: '700',
    },
  });
}
