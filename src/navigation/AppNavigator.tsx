import React, { useEffect } from 'react';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LoginScreen } from '../screens/LoginScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ReceiptDetailScreen } from '../screens/ReceiptDetailScreen';
import { MenuModal } from '../components/MenuModal';
import { BiometricPromptModal } from '../components/BiometricPromptModal';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useMenuStore } from '../stores/menuStore';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Preview: { imageUri: string };
  Camera: undefined;
  ReceiptDetail: {
    receiptId: string;
    fileName: string;
    description: string | null;
    period: string;
    isFiscal: boolean;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function HeaderMenuButton() {
  const colors = useThemeStore((s) => s.colors);
  return (
    <TouchableOpacity onPress={() => useMenuStore.getState().open()} style={{ padding: 8 }}>
      <Ionicons name="menu" size={24} color={colors.headerText} />
    </TouchableOpacity>
  );
}

function MainTabs() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerShown: true,
        headerTitle: 'Auditera',
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <HeaderMenuButton />,
      }}
    >
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: 'Slikaj',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Istorija',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isBootstrapping, bootstrap } = useAuthStore();
  const colors = useThemeStore((s) => s.colors);

  useEffect(() => {
    void bootstrap();
  }, []);

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: colors.headerBackground },
            headerTintColor: colors.headerText,
          }}
        >
          {!isAuthenticated ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="Preview"
                component={PreviewScreen}
                options={{ headerShown: true, title: 'Pregled računa' }}
              />
              <Stack.Screen
                name="ReceiptDetail"
                component={ReceiptDetailScreen}
                options={{ headerShown: true, title: 'Račun' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <MenuModal />
      <BiometricPromptModal />
    </>
  );
}
