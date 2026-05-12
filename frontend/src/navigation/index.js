import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    EnterPhoneScreen,
    VerifyOtpScreen,
    EnterDetailsScreen,
    DashboardScreen,
} from '../screens';
import { startup } from '../api/authApi';

const Stack = createNativeStackNavigator();

function StartupScreen({ navigation }) {
    useEffect(() => {
        (async () => {
            try {
                const token = await AsyncStorage.getItem('session_token');
                if (!token) {
                    navigation.replace('EnterPhone');
                    return;
                }
                const response = await startup(token);
                const nextScreen = response?.next_screen;
                const phone = (await AsyncStorage.getItem('session_phone')) || '';

                if (nextScreen === 'dashboard') {
                    const role = response?.user?.role;
                    navigation.replace('Dashboard', { phone, role, sessionToken: token });
                } else if (nextScreen === 'enter_details') {
                    navigation.replace('EnterDetails', { phone, sessionToken: token });
                } else {
                    // Server explicitly says session is invalid — clear and re-login
                    await AsyncStorage.multiRemove(['session_token', 'session_phone']);
                    navigation.replace('EnterPhone');
                }
            } catch (_e) {
                // Network error or timeout — keep storage intact, let user retry login
                navigation.replace('EnterPhone');
            }
        })();
    }, [navigation]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
        </View>
    );
}

export default function AppNavigation() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Startup">
                <Stack.Screen name="Startup" component={StartupScreen} />
                <Stack.Screen name="EnterPhone" component={EnterPhoneScreen} />
                <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
                <Stack.Screen name="EnterDetails" component={EnterDetailsScreen} />
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
