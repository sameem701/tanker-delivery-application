import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { storeOtp, verifyOtp } from '../../api/commonApi';
import { AuthContext } from '../../state/AuthContext';

export default function OtpScreen({ route, navigation }) {
  const { phone } = route.params;
  const { login } = useContext(AuthContext);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);

  const handleRequestOtp = async () => {
    setRequestingOtp(true);
    try {
      setTimeout(() => {
        Alert.alert('Sandbox Mode', 'OTP is set to: 123456');
        setRequestingOtp(false);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message);
      setRequestingOtp(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'OTP must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      setTimeout(() => {
        const mockResponse = {
          success: true,
          data: {
            session_token: 'mock_token',
            role: 'undefined',
            user_id: 1,
            next_screen: 'enter_details'
          }
        };

        if (mockResponse.data.next_screen === 'enter_details') {
          navigation.replace('EnterDetails', { session_token: mockResponse.data.session_token, userId: mockResponse.data.user_id });
        } else {
          login(mockResponse.data.session_token, mockResponse.data.role, mockResponse.data.user_id);
        }
        setLoading(false);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verification code</Text>
        <Text style={styles.subtitle}>We sent a code to {phone}</Text>

        <TouchableOpacity onPress={handleRequestOtp} style={styles.requestBtn}>
          <Text style={styles.requestText}>Get Code (Sandbox)</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit code"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || otp.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Verify & Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 16 },
  requestBtn: { paddingVertical: 8, marginBottom: 24 },
  requestText: { color: '#0066ff', fontSize: 16, fontWeight: '600' },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
    letterSpacing: 4,
    textAlign: 'center'
  },
  button: {
    height: 56,
    backgroundColor: '#0066ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#a0c4ff' },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});
