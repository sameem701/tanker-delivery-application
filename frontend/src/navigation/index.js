import React, { useContext, useCallback } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { CustomerDashboard, SupplierDashboard, DriverDashboard } from '../screens';
import HistoryScreen from '../screens/common/HistoryScreen';
import { AuthContext } from '../state/AuthContext';
import { apiRequest } from '../api/client';

import EnterNumberScreen from '../screens/auth/EnterNumberScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import EnterDetailsScreen from '../screens/auth/EnterDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="EnterNumber" component={EnterNumberScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
            <Stack.Screen name="EnterDetails" component={EnterDetailsScreen} />
        </Stack.Navigator>
    );
}

// Dummy screen - never actually renders, tab press is intercepted
function LogoutScreen() {
    return <View />;
}

export default function AppNavigation() {
    const { userToken, userRole, isLoading, logout } = useContext(AuthContext);

    const handleLogout = useCallback(() => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    // Mock logout - no API call
                    await logout();
                },
            },
        ]);
    }, [logout]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0066ff" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {userToken == null ? (
                <AuthStack />
            ) : (
                <Tab.Navigator
                    screenOptions={{
                        headerShown: false,
                        tabBarActiveTintColor: '#0066ff',
                        tabBarInactiveTintColor: '#999',
                        tabBarLabelStyle: { fontWeight: '700' },
                    }}
                >
                    {userRole === 'customer' && (
                        <Tab.Screen name="Customer" component={CustomerDashboard} options={{ tabBarLabel: 'Request Orders' }} />
                    )}
                    {userRole === 'supplier' && (
                        <Tab.Screen name="Supplier" component={SupplierDashboard} options={{ tabBarLabel: 'Market Orders' }} />
                    )}
                    {userRole === 'driver' && (
                        <Tab.Screen name="Driver" component={DriverDashboard} options={{ tabBarLabel: 'My Deliveries' }} />
                    )}
                    <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History' }} />
                    <Tab.Screen
                        name="Logout"
                        component={LogoutScreen}
                        options={{
                            tabBarLabel: 'Logout',
                            tabBarButton: (props) => (
                                <TouchableOpacity
                                    {...props}
                                    onPress={handleLogout}
                                    style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 6 }}
                                >
                                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 10 }}>Logout</Text>
                                </TouchableOpacity>
                            ),
                        }}
                    />
                </Tab.Navigator>
            )}
        </NavigationContainer>
    );
}
