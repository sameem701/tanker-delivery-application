import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import CustomerDashboard from './dashboard/CustomerDashboard';
import SupplierDashboard from './dashboard/SupplierDashboard';
import DriverDashboard from './dashboard/DriverDashboard';
import BasicButton from '../components/ui/BasicButton';
import { logoutCustomer, logoutSupplier, logoutDriver } from '../api/authApi';

export default function DashboardScreen({ route, navigation }) {
    const { phone, role, sessionToken } = route.params || { phone: 'Unknown', role: 'undefined', sessionToken: '' };
    const [loggingOut, setLoggingOut] = useState(false);

    const logoutByRole = {
        customer: logoutCustomer,
        supplier: logoutSupplier,
        driver: logoutDriver
    };

    async function handleLogout() {
        const logoutFn = logoutByRole[role];

        if (!logoutFn) {
            Alert.alert('Error', `Unknown role: ${role}`);
            return;
        }

        if (!sessionToken) {
            Alert.alert('Error', 'Missing session token. Please login again.');
            return;
        }

        try {
            setLoggingOut(true);
            await logoutFn(sessionToken);
            navigation.reset({ index: 0, routes: [{ name: 'EnterPhone' }] });
        } catch (error) {
            Alert.alert('Logout Failed', error.message || 'Failed to logout');
        } finally {
            setLoggingOut(false);
        }
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '90%', maxWidth: 420 }}>
                <Text>Role: {role}</Text>
                <Text>Phone: {phone}</Text>
                <BasicButton title={loggingOut ? 'Logging out...' : 'Logout'} onPress={handleLogout} disabled={loggingOut} />
            </View>

            {role === 'customer' && <CustomerDashboard sessionToken={sessionToken} />}
            {role === 'supplier' && <SupplierDashboard sessionToken={sessionToken} />}
            {role === 'driver' && <DriverDashboard sessionToken={sessionToken} />}
            {role !== 'customer' && role !== 'supplier' && role !== 'driver' && (
                <Text>Unknown role: {role}</Text>
            )}
        </View>
    );
}