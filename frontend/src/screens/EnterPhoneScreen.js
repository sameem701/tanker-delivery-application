import { useState } from 'react';
import { ActivityIndicator, Text, View, TextInput } from 'react-native';
import { enterNumber, storeOtp } from '../api/authApi';
import BasicButton from '../components/ui/BasicButton';

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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: '90%', maxWidth: 420 }}>
                <Text>Tanker Delivery</Text>
                <Text>Enter Phone Number</Text>

                {errorMessage ? <Text>{errorMessage}</Text> : null}
                {infoMessage ? <Text>{infoMessage}</Text> : null}

                <View>
                    <Text>Phone Number</Text>
                    <TextInput
                        placeholder="+91 9876543210"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                        style={{ borderWidth: 1 }}
                    />
                    <BasicButton title="Send OTP" onPress={handleSendOtp} disabled={loading || !canSendOtp} />
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
