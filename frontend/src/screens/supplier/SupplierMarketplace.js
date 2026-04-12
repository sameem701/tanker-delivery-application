import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Modal, ScrollView
} from 'react-native';
import { getAvailableOrders, placeBid } from '../../api/supplierApi';
import { apiRequest } from '../../api/client';
import { socket } from '../../api/socket';
import { MapPin, Droplet, Send, Info } from 'lucide-react-native';

export default function SupplierMarketplace({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidPrices, setBidPrices] = useState({});   // orderId -> string
  const [bidErrors, setBidErrors] = useState({});    // orderId -> string
  const [submittingBid, setSubmittingBid] = useState(null);

  // Order detail modal state
  const [detailModal, setDetailModal] = useState(null);   // null | order detail object
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchOrders();

    // 8-second poll fallback
    const interval = setInterval(() => fetchOrders(), 8000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setTimeout(() => {
        setOrders([
          { order_id: 1, requested_capacity: '1000', customer_bid_price: '5000', service_type: 'Standard', delivery_instructions: 'Gate 2' },
          { order_id: 2, requested_capacity: '2000', customer_bid_price: '9000', service_type: 'Express', delivery_instructions: 'Call on arrival' }
        ]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.log('Error fetching available orders:', error);
      if (loading) setLoading(false);
    }
  };

  const handleViewDetails = async (orderId) => {
    setDetailLoading(true);
    setTimeout(() => {
      setDetailModal({
        order_id: orderId,
        pickup_address: { block: 'A', area: 'DHA' },
        dropoff_address: { block: 'B', area: 'Clifton' },
        distance_km: 12.5,
        estimated_time_mins: 30
      });
      setDetailLoading(false);
    }, 500);
  };

  const handlePlaceBid = async (orderId) => {
    const price = bidPrices[orderId];
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      setBidErrors(prev => ({ ...prev, [orderId]: 'Please enter a valid bid price.' }));
      return;
    }
    setBidErrors(prev => ({ ...prev, [orderId]: '' }));
    setSubmittingBid(orderId);

    setTimeout(() => {
      Alert.alert('Bid Sent!', 'Wait for the customer to accept your offer.');
      setBidPrices(prev => ({ ...prev, [orderId]: '' }));
      setSubmittingBid(null);
    }, 500);
  };

  const renderOrder = ({ item }) => {
    const orderId = item.order_id;
    if (orderId == null) return null; // Guard against malformed entries

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.gallonsBadge}>
            <Droplet size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.gallonsText}>{item.requested_capacity} Gal</Text>
          </View>
          <Text style={styles.priceTag}>Customer Offer: PKR {item.customer_bid_price}</Text>
        </View>

        {/* Location is hidden until details are viewed */}
        <View style={styles.detailRow}>
          <MapPin size={16} color="#999" style={{ marginRight: 8 }} />
          <Text style={styles.hiddenLocation}>Location hidden — tap Details to reveal</Text>
        </View>

        {/* View Details & Bid Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => handleViewDetails(orderId)}
            disabled={detailLoading}
          >
            <Info size={16} color="#0066ff" style={{ marginRight: 4 }} />
            <Text style={styles.detailsBtnText}>Details</Text>
          </TouchableOpacity>

          <View style={styles.bidInputContainer}>
            <Text style={styles.pkrLabel}>PKR</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="Your Bid"
              keyboardType="numeric"
              value={bidPrices[orderId] || ''}
              onChangeText={(val) => {
                setBidPrices(prev => ({ ...prev, [orderId]: val }));
                setBidErrors(prev => ({ ...prev, [orderId]: '' }));
              }}
            />
          </View>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => handlePlaceBid(orderId)}
            disabled={submittingBid === orderId}
          >
            {submittingBid === orderId
              ? <ActivityIndicator color="#fff" size="small" />
              : <Send size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        {!!bidErrors[orderId] && (
          <Text style={styles.errorText}>{bidErrors[orderId]}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Live Market</Text>

      {orders.length === 0 ? (
        <View style={styles.center}>
          <MapPin size={48} color="#ccc" />
          <Text style={{ color: '#666', marginTop: 16 }}>No open orders in your area right now.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.order_id)}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* Order Detail Modal */}
      <Modal visible={!!detailModal} transparent animationType="slide" onRequestClose={() => setDetailModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Order Details</Text>
            {detailModal && (
              <ScrollView>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Customer</Text>
                  <Text style={styles.modalValue}>{detailModal.customer_name || '—'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Delivery Location</Text>
                  <Text style={styles.modalValue}>{detailModal.delivery_location || detailModal.address || '—'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Capacity</Text>
                  <Text style={styles.modalValue}>{detailModal.requested_capacity} Gallons</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Customer Offer</Text>
                  <Text style={styles.modalValue}>PKR {detailModal.customer_bid_price}</Text>
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetailModal(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', padding: 16, paddingBottom: 8, color: '#1a1a1a' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gallonsBadge: { flexDirection: 'row', backgroundColor: '#0066ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignItems: 'center' },
  gallonsText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  priceTag: { fontSize: 14, fontWeight: 'bold', color: '#28a745' },

  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  hiddenLocation: { color: '#aaa', fontSize: 13, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#0066ff', marginRight: 8 },
  detailsBtnText: { color: '#0066ff', fontWeight: 'bold', fontSize: 13 },

  bidInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 8, paddingHorizontal: 10, height: 44, marginRight: 8 },
  pkrLabel: { fontWeight: 'bold', color: '#333', marginRight: 4, fontSize: 13 },
  priceInput: { flex: 1, fontSize: 15, color: '#333' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 20 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  modalLabel: { fontSize: 14, color: '#666', flex: 1 },
  modalValue: { fontSize: 14, fontWeight: '600', color: '#333', flex: 2, textAlign: 'right' },
  closeBtn: { marginTop: 20, height: 52, backgroundColor: '#1a1a1a', borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
