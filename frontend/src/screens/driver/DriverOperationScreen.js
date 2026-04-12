import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { getOrderDetails, acceptOrder, rejectOrder, startRide, markReached, finishOrder } from '../../api/driverApi';
import { socket } from '../../api/socket';
import { MapPin, Navigation, Map, Navigation2, CheckCircle } from 'lucide-react-native';

export default function DriverOperationScreen({ token, activeOrderId, onStateChange }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeOrderId) {
      fetchDetails();
    } else {
      setLoading(false);
    }
  }, [activeOrderId]);

  const fetchDetails = async () => {
    try {
      setTimeout(() => {
        setDetails({
          status: 'supplier_timer',
          address: 'Main Street 123',
          customer_name: 'Mock Customer',
          customer_phone: '123-456-7890',
          supplier_name: 'Mock Supplier'
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      console.log('Error fetching driver order details:', error);
      setLoading(false);
    }
  };

  const handleAction = async (actionFn, actionName) => {
    setActionLoading(true);
    try {
      setTimeout(() => {
        if (actionName === 'reject') {
          onStateChange(null);
        } else if (actionName === 'finish') {
          Alert.alert('Delivery Complete', 'Great job! Returning to waiting state.');
          onStateChange(null);
        } else {
          // manually advance state based on action
          const nextState = {
            'accept': 'accepted',
            'start': 'ride_started',
            'reached': 'reached'
          }[actionName] || details.status;

          setDetails(prev => ({ ...prev, status: nextState }));
        }
        setActionLoading(false);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message);
      setActionLoading(false);
    }
  };

  if (!activeOrderId) {
    return (
      <View style={styles.idleContainer}>
        <View style={styles.radarCircle}>
          <MapPin size={48} color="#0066ff" />
        </View>
        <Text style={styles.idleTitle}>You're Online</Text>
        <Text style={styles.idleSubtitle}>Waiting for supplier assignments...</Text>
      </View>
    );
  }

  if (loading || !details) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0066ff" /></View>;
  }

  // Render logic based on order status
  const currentStatus = details.status;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.mapMock}>
        <Map size={64} color="#aaa" />
        <Text style={{ color: '#666', marginTop: 12 }}>GPS Tracking Active</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderTitle}>Delivery Task</Text>
          <Text style={styles.badge}>{currentStatus.replace('_', ' ').toUpperCase()}</Text>
        </View>

        <View style={styles.detailRow}>
          <Navigation size={20} color="#666" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.detailLabel}>Dropoff Address</Text>
            <Text style={styles.detailValue}>{details.address || "Address not provided"}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <MapPin size={20} color="#666" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.detailLabel}>Customer Contact</Text>
            <Text style={styles.detailValue}>{details.customer_name} • {details.customer_phone}</Text>
          </View>
        </View>

        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <MapPin size={20} color="#666" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.detailLabel}>Supplier Contact</Text>
            <Text style={styles.detailValue}>{details.supplier_name}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {currentStatus === 'supplier_timer' && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleAction(rejectOrder, 'reject')} disabled={actionLoading}>
                <Text style={styles.rejectText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAction(acceptOrder, 'accept')} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>Accept Order</Text>}
              </TouchableOpacity>
            </View>
          )}

          {currentStatus === 'accepted' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAction(startRide, 'start')} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> :
                <>
                  <Navigation2 size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Start Ride</Text>
                </>}
            </TouchableOpacity>
          )}

          {currentStatus === 'ride_started' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleAction(markReached, 'reached')} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> :
                <>
                  <MapPin size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Mark as Reached</Text>
                </>}
            </TouchableOpacity>
          )}

          {currentStatus === 'reached' && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#28a745' }]} onPress={() => handleAction(finishOrder, 'finish')} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> :
                <>
                  <CheckCircle size={24} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Complete Delivery</Text>
                </>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  idleContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  radarCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e6f0ff', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  idleTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  idleSubtitle: { fontSize: 16, color: '#666' },
  mapMock: { height: 250, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', margin: 16, marginTop: -32, borderRadius: 16, padding: 24, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  orderTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  badge: { backgroundColor: '#ffeeba', color: '#856404', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: 'bold' },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailLabel: { fontSize: 12, color: '#999', marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 16, color: '#333', fontWeight: '500' },
  actionContainer: { marginTop: 32 },
  rejectBtn: { flex: 1, height: 56, backgroundColor: '#ffebee', justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginRight: 12 },
  rejectText: { color: '#d32f2f', fontWeight: 'bold', fontSize: 16 },
  acceptBtn: { flex: 2, height: 56, backgroundColor: '#0066ff', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  acceptText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  primaryBtn: { height: 56, backgroundColor: '#1a1a1a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
