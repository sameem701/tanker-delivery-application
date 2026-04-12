import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { submitCustomerDetails, submitDriverDetails, submitSupplierDetails } from '../api/authApi';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import ErrorBanner from '../components/ui/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme/tokens';

function getErrorMessage(error) {
    return error?.message || 'Something went wrong. Please try again.';
}

export default function EnterDetailsScreen({ route, navigation }) {
    const { sessionToken, phone } = route.params;
    const [selectedRole, setSelectedRole] = useState('customer');
    const [name, setName] = useState('');
    const [homeAddress, setHomeAddress] = useState('');
    const [yardLocation, setYardLocation] = useState('');
    const [businessContact, setBusinessContact] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const canSubmitDetails = name.trim().length > 0;

    async function handleSubmitDetails() {
        if (!name.trim()) {
            setErrorMessage('Name is required.');
            return;
        }

        if (selectedRole === 'supplier' && (!yardLocation.trim() || !businessContact.trim())) {
            setErrorMessage('Yard location and business contact are required for supplier.');
            return;
        }

        try {
            setLoading(true);
            setErrorMessage('');

            // Mocked detail submission
            await new Promise(resolve => setTimeout(resolve, 500));

            navigation.navigate('Dashboard', { phone, role: selectedRole });
        } catch (error) {
            const message = getErrorMessage(error);
            if (error?.status === 401 && error?.payload?.data?.next_screen === 'enter_number') {
                navigation.navigate('EnterPhoneScreen');
                return;
            }
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.card}>
                <Text style={styles.title}>Tanker Delivery</Text>
                <Text style={styles.subtitle}>Enter Details</Text>

                <ErrorBanner message={errorMessage} />

                <View style={styles.section}>
                    <Text style={styles.successText}>Choose role and submit details.</Text>
                    <View style={styles.roleRow}>
                        {['customer', 'supplier', 'driver'].map((role) => (
                            <Pressable
                                key={role}
                                onPress={() => setSelectedRole(role)}
                                style={[styles.roleChip, selectedRole === role ? styles.roleChipActive : null]}
                            >
                                <Text style={[styles.roleChipText, selectedRole === role ? styles.roleChipTextActive : null]}>
                                    {role}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <AppInput label="Name" placeholder="Enter your name" value={name} onChangeText={setName} />

                    {selectedRole === 'customer' ? (
                        <AppInput label="Home Address (optional)" placeholder="Enter home address" value={homeAddress} onChangeText={setHomeAddress} />
                    ) : null}

                    {selectedRole === 'supplier' ? (
                        <>
                            <AppInput label="Yard Location" placeholder="Enter yard location" value={yardLocation} onChangeText={setYardLocation} />
                            <AppInput label="Business Contact" placeholder="Enter business contact" value={businessContact} onChangeText={setBusinessContact} />
                        </>
                    ) : null}

                    <AppButton title="Submit Details" onPress={handleSubmitDetails} disabled={loading || !canSubmitDetails} />
                </View>

                {loading && (
                    <View style={styles.loaderRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.loaderText}>Please wait...</Text>
                    </View>
                )}
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
    roleRow: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.xs },
    roleChip: { flex: 1, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center' },
    roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    roleChipText: { color: colors.textSecondary, fontSize: typography.caption, fontWeight: '600', textTransform: 'capitalize' },
    roleChipTextActive: { color: '#fff' },
    loaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, gap: spacing.sm },
    loaderText: { color: colors.textSecondary, fontSize: typography.caption },
});