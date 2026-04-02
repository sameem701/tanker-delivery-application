import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { enterNumber, storeOtp } from '../api/authApi';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import ErrorBanner from '../components/ui/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme/tokens';

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getErrorMessage(error) {
    if (error?.payload?.retry_after_seconds) {
        return `${error.message} Retry in ${error.payload.retry_after_seconds} seconds.`;
    }
    return error?.message || 'Something went wrong. Please try again.';
}

export default function EnterPhoneScreen({ navigation }) {
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('');

    const canSendOtp = phone.trim().length > 0;

    async function handleSendOtp() {
        if (!phone.trim()) {
            setErrorMessage('Phone number is required.');
            return;
        }

        try {
            setLoading(true);
            setErrorMessage('');
            setInfoMessage('');

            await enterNumber(phone.trim());
            const generatedOtp = generateOtp();
            console.log('Generated verification code:', generatedOtp);
            await storeOtp(phone.trim(), generatedOtp);

            navigation.navigate('VerifyOtp', { phone: phone.trim() });
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.card}>
                <Text style={styles.title}>Tanker Delivery</Text>
                <Text style={styles.subtitle}>Enter Phone Number</Text>

                <ErrorBanner message={errorMessage} />
                {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

                <View style={styles.section}>
                    <AppInput
                        label="Phone Number"
                        placeholder="+91 9876543210"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />
                    <AppButton title="Send OTP" onPress={handleSendOtp} disabled={loading || !canSendOtp} />
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
    container: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
    },
    title: {
        color: colors.textPrimary,
        fontSize: typography.title,
        fontWeight: '700',
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: typography.body,
    },
    section: {
        gap: spacing.md,
    },
    infoText: {
        color: colors.success,
        fontSize: typography.caption,
    },
    loaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    loaderText: {
        color: colors.textSecondary,
        fontSize: typography.caption,
    },
});
