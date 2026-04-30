import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
  Animated,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { receiptsApi } from '../api/client';
import { useThemeStore } from '../stores/themeStore';
import type { ColorScheme } from '../theme/colors';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Camera'>;
};

export function CameraScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const qrDetectedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerAnim = useRef(new Animated.Value(-60)).current;
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useFocusEffect(
    useCallback(() => {
      qrDetectedRef.current = false;
      setIsSubmitting(false);
      setIsFocused(true);
      bannerAnim.setValue(-60);
      return () => {
        setIsFocused(false);
        if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
      };
    }, [bannerAnim]),
  );

  const showSuccessBanner = useCallback(() => {
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(bannerAnim, { toValue: -60, duration: 300, useNativeDriver: true }),
    ]).start(() => navigation.navigate('Main'));
  }, [bannerAnim, navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      (codes) => {
        if (codes.length === 0 || qrDetectedRef.current || isSubmittingRef.current) return;
        const qrValue = codes[0].value;
        if (!qrValue) return;

        qrDetectedRef.current = true;
        Vibration.vibrate(100);

        // Safety timeout: reset qrDetectedRef after 30s in case Alert.prompt fails
        qrTimeoutRef.current = setTimeout(() => {
          qrDetectedRef.current = false;
        }, 30_000);

        Alert.prompt(
          'Fiskalni račun detektovan',
          'Unesite opis (opciono):',
          [
            {
              text: 'Otkaži',
              style: 'cancel',
              onPress: () => {
                if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
                qrDetectedRef.current = false;
              },
            },
            {
              text: 'Pošalji',
              onPress: async (description: string | undefined) => {
                if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
                setIsSubmitting(true);
                try {
                  await receiptsApi.submitFiscal(qrValue, description);
                  showSuccessBanner();
                } catch (e: unknown) {
                  const detail = isAxiosError(e)
                    ? `Status: ${e.response?.status}\n\n${JSON.stringify(e.response?.data, null, 2)}`
                    : String(e);
                  Alert.alert('Greška pri slanju', detail);
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
      [showSuccessBanner],
    ),
  });

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
      {/* Success banner */}
      <Animated.View
        style={[styles.successBanner, { transform: [{ translateY: bannerAnim }] }]}
        pointerEvents="none"
      >
        <Text style={styles.successBannerText}>Račun uspješno poslan ✓</Text>
      </Animated.View>

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && !isSubmitting}
        photo={true}
        codeScanner={codeScanner}
      />

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
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 80,
      paddingBottom: 48,
    },
    successBanner: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: '#22c55e',
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    successBannerText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
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
