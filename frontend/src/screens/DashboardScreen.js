import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, BackHandler, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { colors, spacing, radius, typography } from '../theme/tokens';
import { SOCKET_URL } from '../constants/config';
import CustomerDashboard from './dashboard/CustomerDashboard';
import SupplierDashboard from './dashboard/SupplierDashboard';
import DriverDashboard from './dashboard/DriverDashboard';
import BasicButton from '../components/ui/BasicButton';
import { logoutCustomer, logoutSupplier, logoutDriver } from '../api/authApi';

export default function DashboardScreen({ route, navigation }) {
    const { phone, role, sessionToken } = route.params || { phone: 'Unknown', role: 'undefined', sessionToken: '' };
    const [loggingOut, setLoggingOut] = useState(false);
    const backPressedOnceRef = useRef(false);

    useEffect(() => {
        const onBackPress = () => {
            if (backPressedOnceRef.current) {
                BackHandler.exitApp();
                return true;
            }
            backPressedOnceRef.current = true;
            Alert.alert('Exit', 'Press back again to exit the app.');
            setTimeout(() => { backPressedOnceRef.current = false; }, 2000);
            return true;
        };
        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => sub.remove();
    }, []);

    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!sessionToken) return;
        const s = io(SOCKET_URL, {
            auth: { token: sessionToken },
            transports: ['websocket'],
        });
        setSocket(s);
        return () => {
            s.disconnect();
            setSocket(null);
        };
    }, [sessionToken]);

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
            await AsyncStorage.multiRemove(['session_token', 'session_phone']);
            navigation.reset({ index: 0, routes: [{ name: 'EnterPhone' }] });
        } catch (error) {
            Alert.alert('Logout Failed', error.message || 'Failed to logout');
        } finally {
            setLoggingOut(false);
        }
    }

    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.roleText}>{roleLabel}</Text>
                    <Text style={styles.phoneText}>{phone}</Text>
                </View>
                <BasicButton
                    title={loggingOut ? '...' : 'Logout'}
                    onPress={handleLogout}
                    disabled={loggingOut}
                    style={styles.logoutButton}
                />
            </View>
            <View style={styles.content}>
                {role === 'customer' && <CustomerDashboard sessionToken={sessionToken} socket={socket} />}
                {role === 'supplier' && <SupplierDashboard sessionToken={sessionToken} socket={socket} />}
                {role === 'driver' && <DriverDashboard sessionToken={sessionToken} socket={socket} />}
                {role !== 'customer' && role !== 'supplier' && role !== 'driver' && (
                    <Text style={styles.unknownRole}>Unknown role: {role}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xl + spacing.xs,
        paddingBottom: spacing.sm,
    },
    roleText: {
        color: colors.textOnPrimary,
        fontSize: typography.subtitle,
        fontWeight: '700',
    },
    phoneText: {
        color: colors.primaryLight,
        fontSize: typography.small,
        marginTop: 2,
    },
    logoutButton: {
        marginTop: 0,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.textOnPrimary,
        borderRadius: radius.sm,
    },
    content: {
        flex: 1,
    },
    unknownRole: {
        color: colors.danger,
        textAlign: 'center',
        marginTop: spacing.lg,
    },
});