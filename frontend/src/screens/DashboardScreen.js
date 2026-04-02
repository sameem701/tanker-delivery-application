import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/ui/AppButton';
import { colors, radius, spacing, typography } from '../theme/tokens';

export default function DashboardScreen({ route, navigation }) {
    const { phone, role } = route.params || { phone: 'Unknown', role: 'undefined' };

    function handleLogout() {
        navigation.reset({ index: 0, routes: [{ name: 'EnterPhone' }] });
    }

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.card}>
                <Text style={styles.title}>Tanker Delivery</Text>
                <Text style={styles.subtitle}>Dashboard</Text>

                <View style={styles.section}>
                    <Text style={styles.successText}>Welcome to the App!</Text>
                    <Text style={styles.metaText}>Role: {role}</Text>
                    <Text style={styles.metaText}>Phone: {phone}</Text>
                    <AppButton title="Logout" onPress={handleLogout} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.lg },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
    title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
    subtitle: { color: colors.textSecondary, fontSize: typography.body },
    section: { gap: spacing.md },
    successText: { color: colors.success, fontSize: typography.caption },
    metaText: { color: colors.textSecondary, fontSize: typography.caption },
});