import React from 'react';
import AppNavigation from './src/navigation';
import { AuthProvider } from './src/state/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AppNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
