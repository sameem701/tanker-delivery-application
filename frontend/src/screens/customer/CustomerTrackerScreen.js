import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { getOrderDetails, cancelOrder } from '../../api/customerApi';
import { Map, MapPin, Truck, Navigation } from 'lucide-react-native';

export default function CustomerTrackerScreen({ token, orderId, onClear }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetails();
    const interval = setInterval(() => fetchDetails(), 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDetails = async () => {
    try {
      setTimeout(() => {
        setDetails({
          driver_name: 'Mock Driver',
          status: 'accepted',
          supplier_name: 'Mock Supplier',
          final_price: 1550
        });
        setLoading(false);
      }, 500);
    } catch (e) {
      console.log('Error fetching tracker details');
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this delivery?', [
      { text: 'No' },
      {
        text: 'Yes, Cancel', onPress: async () => {
          try {
            setTimeout(() => {
              Alert.alert('Cancelled', 'Your order was cancelled.');
              onClear();
            }, 500);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }, style: 'destructive'
      }
    ]);
  };

  if (loading || !details) return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.mapMock}>
        <Map size={48} color="#0066ff" />
        <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Tracking Driver #{details.driver_name || 'Pending'}</Text>
        <Text style={{ color: '#666' }}>Status: {details.status.toUpperCase()}</Text>
      </View>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Truck size={24} color="#0066ff" />
          <View style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Supplier: {details.supplier_name}</Text>
            <Text style={{ color: '#666' }}>Final Price: Rs {details.final_price}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Cancel Delivery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapMock: { height: 300, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', margin: 16, marginTop: -24, borderRadius: 16, padding: 24, elevation: 4 },
  cancelBtn: { marginTop: 16, height: 48, backgroundColor: '#ffebee', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  cancelBtnText: { color: '#d32f2f', fontWeight: 'bold' }
});
