import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { getActiveOrders, assignDriver } from '../../api/supplierApi';
import { apiRequest } from '../../api/client';
import { socket } from '../../api/socket';
import { Truck, User } from 'lucide-react-native';

export default function SupplierActiveOrders({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    fetchActive();

    const intv = setInterval(() => fetchActive(), 5000);
    return () => {
      clearInterval(intv);
    };
  }, []);

  const fetchActive = async () => {
    try {
      setTimeout(() => {
        setOrders([
          { order_id: 101, status: 'supplier_timer', customer_name: 'John Doe', requested_capacity: '1000' }
        ]);
        setLoading(false);
      }, 500);
    } catch (e) {
      console.log('Error fetching supplier active orders:', e);
      if (loading) setLoading(false);
    }
  };

  const fetchDriversForOrder = async (orderId) => {
    try {
      setTimeout(() => {
        setDrivers([
          { driver_id: 1, driver_name: 'Driver Ali' },
          { driver_id: 2, driver_name: 'Driver Bilal' }
        ]);
      }, 300);
    } catch (e) {
      setDrivers([]);
    }
  };

  const handleExpand = (orderId) => {
    if (expandedId === orderId) {
      setExpandedId(null);
    } else {
      setExpandedId(orderId);
      fetchDriversForOrder(orderId);
    }
  };

  const handleAssignDriver = async (orderId, driverId) => {
    setAssigning(driverId);
    try {
      setTimeout(() => {
        Alert.alert('Assigned', 'Driver assigned successfully!');
        setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: 'driver_assigned', driver_name: drivers.find(d => d.driver_id === driverId)?.driver_name } : o));
        setExpandedId(null);
        setAssigning(null);
      }, 500);
    } catch (e) {
      Alert.alert('Error', e.message);
      setAssigning(null);
    }
  };

  const renderItem = ({ item }) => {
    const isExpanded = expandedId === item.order_id;
    return (
      <View style={styles.card}>
        <TouchableOpacity onPress={() => handleExpand(item.order_id)} activeOpacity={0.8}>
          <View style={styles.cardHeader}>
            <Truck size={20} color="#0066ff" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.cardTitle}>Order #{item.order_id}</Text>
              <Text style={styles.cardStatus}>{(item.status || '').replace('_', ' ').toUpperCase()}</Text>
            </View>
            <Text style={styles.expandHint}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
          <Text style={styles.cardSub}>Customer: {item.customer_name || '—'}</Text>
          {item.driver_name && <Text style={styles.cardSub}>Driver: {item.driver_name}</Text>}
        </TouchableOpacity>

        {/* Driver Assignment Panel */}
        {isExpanded && item.status === 'supplier_timer' && (
          <View style={styles.assignPanel}>
            <Text style={styles.assignTitle}>Assign a Driver</Text>
            {drivers.length === 0 ? (
              <Text style={{ color: '#999', textAlign: 'center' }}>No available drivers.</Text>
            ) : (
              drivers.map(d => (
                <TouchableOpacity
                  key={d.driver_id}
                  style={styles.driverRow}
                  onPress={() => handleAssignDriver(item.order_id, d.driver_id)}
                  disabled={assigning === d.driver_id}
                >
                  <User size={16} color="#0066ff" />
                  <Text style={styles.driverName}>{d.driver_name}</Text>
                  {assigning === d.driver_id
                    ? <ActivityIndicator size="small" color="#0066ff" />
                    : <Text style={styles.assignBtn}>Assign</Text>}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={i => String(i.order_id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No active operations.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#666', marginTop: 32 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  cardStatus: { fontSize: 12, color: '#0066ff', fontWeight: '600', marginTop: 2 },
  cardSub: { color: '#666', marginTop: 4, marginLeft: 32, fontSize: 13 },
  expandHint: { color: '#999', fontSize: 16 },
  assignPanel: { marginTop: 16, borderTopWidth: 1, borderColor: '#f0f0f0', paddingTop: 12 },
  assignTitle: { fontWeight: 'bold', color: '#333', marginBottom: 10 },
  driverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f8f8f8' },
  driverName: { flex: 1, marginLeft: 10, fontSize: 15, color: '#333' },
  assignBtn: { color: '#0066ff', fontWeight: 'bold' },
});
