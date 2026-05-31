import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from '../screens/SplashScreen';

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

                // run API and 5 second timer simultaneously
                const [response] = await Promise.all([
                    token ? startup(token) : Promise.resolve(null),
                    new Promise(resolve => setTimeout(resolve, 5000)), // minimum 5s splash
                ]);

                const nextScreen = response?.next_screen;
                const phone = (await AsyncStorage.getItem('session_phone')) || '';

                if (!token || !nextScreen || nextScreen === 'enter_number') {
                    await AsyncStorage.multiRemove(['session_token', 'session_phone']);
                    navigation.replace('EnterPhone');
                } else if (nextScreen === 'dashboard') {
                    const role = response?.user?.role;
                    navigation.replace('Dashboard', { phone, role, sessionToken: token });
                } else if (nextScreen === 'enter_details') {
                    navigation.replace('EnterDetails', { phone, sessionToken: token });
                } else {
                    await AsyncStorage.multiRemove(['session_token', 'session_phone']);
                    navigation.replace('EnterPhone');
                }
            } catch (_e) {
                navigation.replace('EnterPhone');
            }
        })();
    }, [navigation]);

    return <SplashScreen />;
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

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
