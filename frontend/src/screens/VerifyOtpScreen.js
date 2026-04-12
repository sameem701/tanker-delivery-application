import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { storeOtp, verifyOtp } from '../api/authApi';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import ErrorBanner from '../components/ui/ErrorBanner';
import { colors, radius, spacing, typography } from '../theme/tokens';

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

            console.log('Mocked Verification code entered:', otpCode.trim());
            await new Promise(resolve => setTimeout(resolve, 500));
            const data = { next_screen: 'enter_details', role: 'undefined', session_token: 'mock_token' };
            const nextScreen = data.next_screen;
            const role = data.role;
            const sessionToken = data.session_token;

            if (nextScreen === 'enter_details') {
                navigation.navigate('EnterDetails', { phone, sessionToken });
            } else {
                navigation.navigate('Dashboard', { phone, role });
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
            console.log('Mocked generated verification code (resend):', generatedOtp);
            await new Promise(resolve => setTimeout(resolve, 500));
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
        <View style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.card}>
                <Text style={styles.title}>Tanker Delivery</Text>
                <Text style={styles.subtitle}>Enter Verification Code</Text>

                <ErrorBanner message={errorMessage} />
                {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}

                <View style={styles.section}>
                    <Text style={styles.helperText}>OTP sent to {phone}</Text>
                    <Text style={styles.helperText}>
                        {cooldownSeconds > 0
                            ? `Request new OTP in ${cooldownSeconds}s`
                            : 'You can request a new OTP now.'}
                    </Text>
                    <AppInput
                        label="Verification Code"
                        placeholder="Enter OTP"
                        keyboardType="number-pad"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        maxLength={6}
                    />
                    <AppButton title="Verify OTP" onPress={handleVerifyOtp} disabled={loading || !canVerifyOtp} />
                    <AppButton title="Request New OTP" onPress={handleResendOtp} disabled={loading || !canResendOtp} />
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

// ... styles can be moved to a shared file later, but we'll include them here for now
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: spacing.lg },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
    title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: '700' },
    subtitle: { color: colors.textSecondary, fontSize: typography.body },
    section: { gap: spacing.md },
    infoText: { color: colors.success, fontSize: typography.caption },
    helperText: { color: colors.textSecondary, fontSize: typography.caption, marginBottom: -spacing.xs },
    loaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, gap: spacing.sm },
    loaderText: { color: colors.textSecondary, fontSize: typography.caption },
});