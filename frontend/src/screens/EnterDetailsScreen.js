import { useState } from 'react';
import { ActivityIndicator, Text, View, TextInput, StyleSheet, ScrollView } from 'react-native';
import { submitCustomerDetails, submitDriverDetails, submitSupplierDetails } from '../api/authApi';
import BasicButton from '../components/ui/BasicButton';
import AppDropdown from '../components/ui/AppDropdown';
import { colors, spacing, radius, typography, shadow } from '../theme/tokens';

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

            if (selectedRole === 'customer') {
                await submitCustomerDetails(sessionToken, { name: name.trim(), home_address: homeAddress.trim() || null });
            } else if (selectedRole === 'driver') {
                await submitDriverDetails(sessionToken, { name: name.trim() });
            } else {
                await submitSupplierDetails(sessionToken, { name: name.trim(), yard_location: yardLocation.trim(), business_contact: businessContact.trim() });
            }

            navigation.navigate('Dashboard', { phone, role: selectedRole, sessionToken });
        } catch (error) {
            const message = getErrorMessage(error);
            if (error?.status === 401 && error?.payload?.data?.next_screen === 'enter_number') {
                navigation.navigate('EnterPhone');
                return;
            }
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                    <Text style={styles.appName}>Pani Chahye</Text>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Choose your role and fill in your details</Text>

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <AppDropdown
                        label="Role"
                        selectedValue={selectedRole}
                        onValueChange={setSelectedRole}
                        placeholder="Select your role"
                        options={[
                            { label: 'Customer', value: 'customer' },
                            { label: 'Supplier', value: 'supplier' },
                            { label: 'Driver', value: 'driver' },
                        ]}
                    />

                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <TextInput
                        placeholder="Enter your name"
                        value={name}
                        onChangeText={setName}
                        style={styles.input}
                        placeholderTextColor={colors.textSecondary}
                    />

                    {selectedRole === 'customer' ? (
                        <View>
                            <Text style={styles.fieldLabel}>Home Address (optional)</Text>
                            <TextInput
                                placeholder="Enter home address"
                                value={homeAddress}
                                onChangeText={setHomeAddress}
                                style={styles.input}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>
                    ) : null}

                    {selectedRole === 'supplier' ? (
                        <View>
                            <Text style={styles.fieldLabel}>Yard Location</Text>
                            <TextInput
                                placeholder="Enter yard location"
                                value={yardLocation}
                                onChangeText={setYardLocation}
                                style={styles.input}
                                placeholderTextColor={colors.textSecondary}
                            />
                            <Text style={styles.fieldLabel}>Business Contact</Text>
                            <TextInput
                                placeholder="Enter business contact number"
                                value={businessContact}
                                onChangeText={setBusinessContact}
                                style={styles.input}
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="phone-pad"
                            />
                        </View>
                    ) : null}

                    <BasicButton
                        title={loading ? 'Submitting...' : 'Submit Details'}
                        onPress={handleSubmitDetails}
                        disabled={loading || !canSubmitDetails}
                        style={styles.button}
                    />

                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
                    ) : null}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.md,
    },
    appName: {
        fontSize: typography.title,
        fontWeight: '800',
        color: colors.primary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: typography.subtitle,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: typography.label,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    errorText: {
        fontSize: typography.label,
        color: colors.danger,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    fieldLabel: {
        fontSize: typography.label,
        fontWeight: '600',
        color: colors.textSecondary,
        marginTop: spacing.sm,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 11,
        fontSize: typography.body,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
    },
    button: {
        marginTop: spacing.md,
    },
    spinner: {
        marginTop: spacing.sm,
    },
});