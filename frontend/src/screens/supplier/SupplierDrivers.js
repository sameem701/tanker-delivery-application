import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, TouchableOpacity, Alert } from 'react-native';
import { listDrivers, addDriver, removeDriver } from '../../api/supplierApi';

export default function SupplierDrivers({ token }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = async () => {
    try {
      setTimeout(() => {
        setDrivers([
          { driver_id: 1, driver_name: 'Driver Ali', driver_phone_num: '03001234567', linked: true },
          { driver_id: 2, driver_name: 'Driver Bilal', driver_phone_num: '03111234567', linked: false }
        ]);
        setLoading(false);
      }, 500);
    } catch (e) {
      console.log(e);
      if (loading) setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!phone) return;
    try {
      setTimeout(() => {
        Alert.alert('Success', 'Driver added');
        setDrivers(prev => [...prev, {
          driver_id: Date.now(),
          driver_name: 'New Driver',
          driver_phone_num: phone,
          linked: false
        }]);
        setPhone('');
      }, 500);
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const renderItem = ({ item }) => {
    const isVerified = item.linked;
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{item.driver_name || 'Unknown Driver'}</Text>
            <Text style={{ color: '#666' }}>{item.driver_phone_num || item.linked_phone}</Text>
          </View>
          <View style={[styles.badge, isVerified ? styles.badgeVerified : styles.badgeUnverified]}>
            <Text style={[styles.badgeText, isVerified ? styles.textVerified : styles.textUnverified]}>
              {isVerified ? 'Verified' : 'Unverified'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.addBox}>
        <TextInput style={styles.input} placeholder="Driver Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TouchableOpacity style={styles.btn} onPress={handleAdd}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Add</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator size="large" /> : (
        <FlatList
          data={drivers}
          keyExtractor={i => i.driver_id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  addBox: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  input: { flex: 1, height: 48, backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 12, marginRight: 8 },
  btn: { height: 48, width: 80, backgroundColor: '#1a1a1a', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgeVerified: { backgroundColor: '#e6f4ea', borderColor: '#34a853' },
  badgeUnverified: { backgroundColor: '#fef3c7', borderColor: '#f5a623' },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  textVerified: { color: '#34a853' },
  textUnverified: { color: '#f5a623' }
});
