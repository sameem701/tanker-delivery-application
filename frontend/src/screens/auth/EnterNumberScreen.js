import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { enterNumber } from '../../api/commonApi';

export default function EnterNumberScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      // Mock successful response
      setTimeout(() => {
        navigation.navigate('Otp', { phone });
        setLoading(false);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message || 'Network error');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Enter your phone number to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Phone Number (e.g. 03001234567)"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, !phone && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={loading || !phone}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
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
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
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
