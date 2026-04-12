import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { getQuantities, startOrder } from '../../api/customerApi';
import { MapPin, Droplet, DollarSign, Navigation } from 'lucide-react-native';

export default function CreateOrderScreen({ token, onOrderCreated }) {
  const [quantities, setQuantities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedQuantityId, setSelectedQuantityId] = useState(null);
  const [basePrice, setBasePrice] = useState('');
  const [priceError, setPriceError] = useState('');
  const [address, setAddress] = useState('');

  // Dummy location for sandbox
  const location_lat = 24.8607;
  const location_lng = 67.0011;

  useEffect(() => {
    fetchQuantities();
  }, []);

  const fetchQuantities = async () => {
    try {
      setTimeout(() => {
        const mockQuantities = [
          { quantity_in_gallon: 1000, base_price: 1500 },
          { quantity_in_gallon: 2000, base_price: 2500 }
        ];
        setQuantities(mockQuantities);
        setSelectedQuantityId(mockQuantities[0].quantity_in_gallon);
        setBasePrice(mockQuantities[0].base_price.toString());
        setLoading(false);
      }, 500);
    } catch (error) {
      console.log('Failed to fetch quantities:', error);
      setLoading(false);
    }
  };

  const handleStartOrder = async () => {
    if (!selectedQuantityId) {
      Alert.alert('Error', 'Please select a water tank size.');
      return;
    }
    if (!basePrice || isNaN(basePrice) || parseFloat(basePrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid base price.');
      return;
    }

    setSubmitting(true);
    try {
      setTimeout(() => {
        setPriceError('');
        onOrderCreated(999); // Mock order ID
        setSubmitting(false);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message || 'Network error');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066ff" />
        <Text style={styles.loadingText}>Loading configurations...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Mock Map Area */}
      <View style={styles.mapMock}>
        <MapPin size={48} color="#0066ff" />
        <Text style={styles.mapText}>Map Preview</Text>
        <Text style={styles.mapSubText}>Delivery Location Set</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery details</Text>

        <View style={styles.inputRow}>
          <Navigation size={20} color="#666" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.textInput}
            value={address}
            onChangeText={setAddress}
            placeholder="Complete Address"
          />
        </View>

        <Text style={styles.sectionTitle}>Tank Capacity</Text>
        <View style={styles.optionsRow}>
          {quantities.map(q => (
            <TouchableOpacity
              key={q.quantity_in_gallon}
              style={[styles.optionCard, selectedQuantityId === q.quantity_in_gallon && styles.optionCardActive]}
              onPress={() => {
                setSelectedQuantityId(q.quantity_in_gallon);
                setBasePrice(q.base_price ? q.base_price.toString() : '');
              }}
            >
              <Droplet size={24} color={selectedQuantityId === q.quantity_in_gallon ? '#fff' : '#0066ff'} />
              <Text style={[styles.optionTitle, selectedQuantityId === q.quantity_in_gallon && styles.optionTextActive]}>
                {q.quantity_in_gallon} Gal
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Your Offer</Text>
        <View style={[styles.inputRow, priceError ? { borderColor: '#ef4444', borderWidth: 1 } : {}]}>
          <Text style={{ fontWeight: 'bold', marginRight: 8, color: '#333' }}>PKR</Text>
          <TextInput
            style={styles.textInput}
            value={basePrice}
            onChangeText={(val) => {
              setBasePrice(val);
              setPriceError('');
            }}
            placeholder="e.g. 1500"
            keyboardType="numeric"
          />
        </View>
        {!!priceError && <Text style={styles.errorText}>{priceError}</Text>}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>Request Tanker</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  mapMock: { height: 200, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  mapText: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 8 },
  mapSubText: { fontSize: 14, color: '#666' },
  card: { backgroundColor: '#fff', margin: -20, padding: 24, paddingVertical: 32, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginTop: 20, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 12, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#e9ecef' },
  textInput: { flex: 1, fontSize: 16, color: '#333' },
  optionsRow: { flexDirection: 'row', marginBottom: 12 },
  optionCard: { width: 100, height: 100, backgroundColor: '#f8f9fa', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 2, borderColor: 'transparent' },
  optionCardActive: { backgroundColor: '#0066ff', borderColor: '#004ecb' },
  optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0066ff', marginTop: 8 },
  optionTextActive: { color: '#fff' },
  primaryButton: { backgroundColor: '#1a1a1a', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 6, paddingHorizontal: 4 }
});
