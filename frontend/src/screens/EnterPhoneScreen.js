import { useState } from 'react';
import { ActivityIndicator, Text, View, TextInput, StyleSheet } from 'react-native';
import { enterNumber, storeOtp } from '../api/authApi';
import BasicButton from '../components/ui/BasicButton';
import { colors, spacing, radius, typography, shadow } from '../theme/tokens';

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
        <View style={styles.screen}>
            <View style={styles.card}>
                <Text style={styles.appName}>Tanker Delivery</Text>
                <Text style={styles.title}>Sign In</Text>
                <Text style={styles.subtitle}>Enter your phone number to continue</Text>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

                <Text style={styles.fieldLabel}>Phone Number</Text>
                <TextInput
                    placeholder="+92 3XX XXXXXXX"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    style={styles.input}
                    placeholderTextColor={colors.textSecondary}
                />
                <BasicButton
                    title={loading ? 'Sending...' : 'Send OTP'}
                    onPress={handleSendOtp}
                    disabled={loading || !canSendOtp}
                    style={styles.button}
                />

                {loading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
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
    infoText: {
        fontSize: typography.label,
        color: colors.success,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    fieldLabel: {
        fontSize: typography.label,
        fontWeight: '600',
        color: colors.textSecondary,
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
