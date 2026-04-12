import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, TextInput } from 'react-native';
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '90%', maxWidth: 420 }}>
                <Text>Tanker Delivery</Text>
                <Text>Enter Verification Code</Text>

                {errorMessage ? <Text>{errorMessage}</Text> : null}
                {infoMessage ? <Text>{infoMessage}</Text> : null}

                <View>
                    <Text>OTP sent to {phone}</Text>
                    <Text>
                        {cooldownSeconds > 0
                            ? `Request new OTP in ${cooldownSeconds}s`
                            : 'You can request a new OTP now.'}
                    </Text>
                    <Text>Verification Code</Text>
                    <TextInput
                        placeholder="Enter OTP"
                        keyboardType="number-pad"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        maxLength={6}
                        style={{ borderWidth: 1 }}
                    />
                    <BasicButton title="Verify OTP" onPress={handleVerifyOtp} disabled={loading || !canVerifyOtp} />
                    <View>
                        <BasicButton title="Request New OTP" onPress={handleResendOtp} disabled={loading || !canResendOtp} />
                    </View>
                </View>

                {loading && (
                    <View>
                        <ActivityIndicator size="small" />
                        <Text>Please wait...</Text>
                    </View>
                )}
            </View>
        </View>
    );
}