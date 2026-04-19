import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { LoginScreen } from '../screens/LoginScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { useAuthStore } from '../stores/authStore';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Preview: { imageUri: string; qrUrl?: string };
  Camera: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a1a2e',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: 'Slikaj',
          tabBarIcon: () => <Text>📷</Text>,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Istorija',
          tabBarIcon: () => <Text>📋</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, loadToken } = useAuthStore();

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
