import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { submitCustomerDetails, submitSupplierDetails, submitDriverDetails } from '../../api/commonApi';
import { AuthContext } from '../../state/AuthContext';

export default function EnterDetailsScreen({ route }) {
  const { session_token, userId } = route.params;
  const { login } = useContext(AuthContext);

  const [role, setRole] = useState('customer'); // customer, supplier, driver
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [yardLocation, setYardLocation] = useState('');
  const [businessContact, setBusinessContact] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      if (role === 'supplier' && (!yardLocation || !businessContact)) {
        Alert.alert('Error', 'Yard Location and Contact are required for Suppliers.');
        setLoading(false);
        return;
      }

      setTimeout(() => {
        login(session_token, role, userId);
        setLoading(false);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message || 'Network error');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Complete Profile</Text>
        <Text style={styles.subtitle}>Select your role and provide details</Text>

        <View style={styles.roleTabs}>
          {['customer', 'supplier', 'driver'].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleTab, role === r && styles.roleActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
        />

        {role === 'customer' && (
          <TextInput
            style={styles.input}
            placeholder="Home Address (Optional)"
            value={address}
            onChangeText={setAddress}
          />
        )}

        {role === 'supplier' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Yard Location"
              value={yardLocation}
              onChangeText={setYardLocation}
            />
            <TextInput
              style={styles.input}
              placeholder="Business Contact Phone"
              keyboardType="phone-pad"
              value={businessContact}
              onChangeText={setBusinessContact}
            />
          </>
        )}

        {/* Note: Drivers may need to be pre-registered by a supplier. If backend returns force_reonboard, it fails here. */}

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Finish Registration</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  roleTabs: { flexDirection: 'row', marginBottom: 32, backgroundColor: '#f0f0f0', borderRadius: 8, padding: 4 },
  roleTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 6 },
  roleActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  roleText: { color: '#666', fontWeight: 'bold' },
  roleTextActive: { color: '#0066ff' },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    height: 56,
    backgroundColor: '#0066ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16
  },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});
