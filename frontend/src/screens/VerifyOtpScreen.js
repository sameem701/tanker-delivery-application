import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, TextInput, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography, shadow } from '../theme/tokens';
import { storeOtp, verifyOtp } from '../api/authApi';
import BasicButton from '../components/ui/BasicButton';

const RESEND_COOLDOWN_SECONDS = 60;

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getErrorMessage(error) {
    if (error?.payload?.retry_after_seconds) {
        return `${error.message} Retry in ${error.payload.retry_after_seconds} seconds.`;
    }
    return error?.message || 'Something went wrong. Please try again.';
}

export default function VerifyOtpScreen({ route, navigation }) {
    const { phone } = route.params;
    const [otpCode, setOtpCode] = useState('');
    const [verifyLocked, setVerifyLocked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [infoMessage, setInfoMessage] = useState('OTP sent');
    const [cooldownSeconds, setCooldownSeconds] = useState(RESEND_COOLDOWN_SECONDS);

    const canVerifyOtp = otpCode.trim().length > 0 && !verifyLocked;
    const canResendOtp = cooldownSeconds === 0;

    useEffect(() => {
        if (cooldownSeconds <= 0) return undefined;
        const intervalId = setInterval(() => {
            setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => clearInterval(intervalId);
    }, [cooldownSeconds]);

    async function handleVerifyOtp() {
        if (!otpCode.trim()) {
            setErrorMessage('Verification code is required.');
            return;
        }

        try {
            setLoading(true);
            setErrorMessage('');
            setInfoMessage('');

            console.log('Entered verification code:', otpCode.trim());
            const response = await verifyOtp(phone, otpCode.trim());
            const data = response?.data || {};
            const nextScreen = data.next_screen || 'enter_number';
            const role = data.role || 'undefined';
            const sessionToken = data.session_token || '';

            await AsyncStorage.setItem('session_token', sessionToken);
            await AsyncStorage.setItem('session_phone', phone);

            if (nextScreen === 'enter_details') {
                navigation.navigate('EnterDetails', { phone, sessionToken });
            } else {
                navigation.navigate('Dashboard', { phone, role, sessionToken });
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('Maximum OTP attempts reached') || message.includes('OTP expired')) {
                setVerifyLocked(true);
            }
            setErrorMessage(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleResendOtp() {
        if (!canResendOtp) return;

        try {
            setLoading(true);
            setErrorMessage('');
            const generatedOtp = generateOtp();
            console.log('Generated verification code (resend):', generatedOtp);
            await storeOtp(phone, generatedOtp);
            setInfoMessage('OTP sent');
            setVerifyLocked(false);
            setOtpCode('');
            setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.screen}>
            <View style={styles.card}>
                <Text style={styles.appName}>Pani Chahye</Text>
                <Text style={styles.title}>Verify OTP</Text>
                <Text style={styles.subtitle}>Code sent to {phone}</Text>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
                {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

                <Text style={styles.cooldownText}>
                    {cooldownSeconds > 0
                        ? `Resend available in ${cooldownSeconds}s`
                        : 'You can request a new code now.'}
                </Text>

                <Text style={styles.fieldLabel}>Verification Code</Text>
                <TextInput
                    placeholder="Enter 6-digit code"
                    keyboardType="number-pad"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    maxLength={6}
                    style={[styles.input, styles.otpInput]}
                    placeholderTextColor={colors.textSecondary}
                />

                <BasicButton
                    title={loading ? 'Verifying...' : 'Verify OTP'}
                    onPress={handleVerifyOtp}
                    disabled={loading || !canVerifyOtp}
                    style={styles.button}
                />
                <BasicButton
                    title={cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Request New OTP'}
                    onPress={handleResendOtp}
                    disabled={loading || !canResendOtp}
                    style={styles.secondaryButton}
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
        marginBottom: spacing.xs,
    },
    cooldownText: {
        fontSize: typography.small,
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
        marginBottom: spacing.xs,
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
    otpInput: {
        textAlign: 'center',
        fontSize: typography.subtitle,
        letterSpacing: 6,
    },
    button: {
        marginTop: spacing.md,
    },
    secondaryButton: {
        marginTop: spacing.xs,
        backgroundColor: colors.primaryLight,
    },
    spinner: {
        marginTop: spacing.sm,
    },
});