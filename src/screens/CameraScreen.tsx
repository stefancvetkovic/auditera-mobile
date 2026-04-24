import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType, BarcodeScanningResult } from 'expo-camera';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { receiptsApi, getApiErrorMessage } from '../api/client';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'>;
};

export function CameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const qrDetectedRef = useRef(false);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Reset detection state every time this screen gains focus
  useFocusEffect(
    useCallback(() => {
      qrDetectedRef.current = false;
      setIsSubmitting(false);
    }, []),
  );

  const barcodeScannerSettings = useMemo(() => ({ barcodeTypes: ['qr'] as const }), []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (result.type !== 'qr' || qrDetectedRef.current) return;

      qrDetectedRef.current = true;
      Vibration.vibrate(100);

      Alert.prompt(
        'Fiskalni račun detektovan',
        'Unesite opis (opciono):',
        [
          {
            text: 'Otkaži',
            style: 'cancel',
            onPress: () => {
              qrDetectedRef.current = false;
            },
          },
          {
            text: 'Pošalji',
            onPress: async (description) => {
              setIsSubmitting(true);
              try {
                await receiptsApi.submitFiscal(result.data, description);
                navigation.navigate('Main');
              } catch (e: unknown) {
                let detail = 'Nepoznata greška';
                if (e instanceof Error) {
                  detail = `${e.name}: ${e.message}\n\n${e.stack ?? ''}`;
                } else {
                  try { detail = JSON.stringify(e, null, 2); } catch { detail = String(e); }
                }
                Alert.alert('Greška [DEBUG]', detail);
                qrDetectedRef.current = false;
              } finally {
                setIsSubmitting(false);
              }
            },
          },
        ],
        'plain-text',
        '',
      );
    },
    [navigation],
  );

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.brand} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Potrebna je dozvola za kameru.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Daj dozvolu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      if (photo) {
        navigation.navigate('Preview', { imageUri: photo.uri });
      }
    } catch {
      Alert.alert('Greška', 'Nije moguće napraviti fotografiju.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={barcodeScannerSettings}
      >
        <View style={styles.overlay}>
          {/* QR scan guide reticle */}
          <View style={styles.reticleContainer}>
            <View style={[styles.reticleCorner, styles.reticleTopLeft]} />
            <View style={[styles.reticleCorner, styles.reticleTopRight]} />
            <View style={[styles.reticleCorner, styles.reticleBottomLeft]} />
            <View style={[styles.reticleCorner, styles.reticleBottomRight]} />
            <Text style={styles.reticleHint}>Usmjeri na QR kod fiskalnog računa</Text>
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
      </CameraView>
    </View>
  );
}

const RETICLE_SIZE = 220;
const CORNER_LENGTH = 24;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = '#fff';

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
    permText: { fontSize: 16, textAlign: 'center', marginBottom: 16, color: colors.text },
    camera: { flex: 1 },
    overlay: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 80,
      paddingBottom: 48,
    },
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
    },
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
  });
}
