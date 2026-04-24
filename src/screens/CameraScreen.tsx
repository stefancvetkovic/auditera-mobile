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
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'>;
};

export function CameraScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');
  const [qrUrl, setQrUrl] = useState<string | undefined>(undefined);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Reset QR state every time this screen gains focus so stale badge doesn't persist
  useFocusEffect(
    useCallback(() => {
      setQrUrl(undefined);
    }, []),
  );

  const barcodeScannerSettings = useMemo(() => ({ barcodeTypes: ['qr'] as const }), []);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (result.type === 'qr' && result.data !== qrUrl) {
        setQrUrl(result.data);
        Vibration.vibrate(100);
      }
    },
    [qrUrl],
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
        navigation.navigate('Preview', { imageUri: photo.uri, qrUrl });
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
            {qrUrl ? (
              <View style={styles.qrBadge}>
                <Text style={styles.qrBadgeText}>QR Fiskalni račun detektovan</Text>
              </View>
            ) : (
              <Text style={styles.reticleHint}>Usmjeri na QR kod fiskalnog računa</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.shutter, capturing && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={capturing}
            accessibilityLabel="Slikaj račun"
            accessibilityRole="button"
          >
            {capturing ? (
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
    qrBadge: {
      backgroundColor: 'rgba(76, 175, 80, 0.9)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    qrBadgeText: { color: '#fff', fontWeight: '600', fontSize: 12 },
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
