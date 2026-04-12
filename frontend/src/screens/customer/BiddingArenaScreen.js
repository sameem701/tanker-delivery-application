import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { getOrderBids, acceptBid, rejectBid, getOpenOrder, cancelOrder } from '../../api/customerApi';
import { Clock, User, MapPin, X } from 'lucide-react-native';

const BidTimerButton = ({ bid, onAccept, onTimeout }) => {
  const animatedWidth = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: 0,
      duration: 10000, // 10 seconds
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onTimeout(bid.bid_id);
      }
    });
  }, []);

  return (
    <TouchableOpacity style={styles.acceptBtnContainer} onPress={() => onAccept(bid.bid_id)}>
      <View style={styles.acceptBtnBase} />
      <Animated.View style={[styles.acceptBtnBg, {
        width: animatedWidth.interpolate({
          inputRange: [0, 100],
          outputRange: ['0%', '100%']
        })
      }]} />
      <Text style={styles.acceptText}>Accept</Text>
    </TouchableOpacity>
  );
};

export default function BiddingArenaScreen({ token, orderId }) {
  const [orderDetails, setOrderDetails] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
    fetchBids();

    const interval = setInterval(() => {
      fetchBids();
    }, 4000); // Poll every 4s for new bids

    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setTimeout(() => {
        setOrderDetails({ order_id: orderId, address: 'Mock Address', capacity: 1000 });
      }, 500);
    } catch (e) {
      console.log('Error fetching open order:', e);
    }
  };

  const fetchBids = async () => {
    try {
      setTimeout(() => {
        setBids(prevBids => {
          if (prevBids.length > 0) return prevBids;
          return [
            { bid_id: 1, supplier_name: 'Mock Supplier 1', supplier_rating: 4.5, bid_price: '1600' },
            { bid_id: 2, supplier_name: 'Mock Supplier 2', supplier_rating: 4.8, bid_price: '1550' }
          ];
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      console.log('Error fetching bids:', error);
      if (loading) setLoading(false);
    }
  };

  const handleAccept = async (bidId) => {
    setActionLoading(bidId);
    try {
      setTimeout(() => {
        Alert.alert('Mock Success', `Accepted bid ${bidId}`);
        setActionLoading(null);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to accept bid');
      setActionLoading(null);
    }
  };

  const handleReject = async (bidId) => {
    setActionLoading(bidId);
    try {
      setTimeout(() => {
        removeBidFromUI(bidId);
      }, 500);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject bid');
      setActionLoading(null);
    }
  };

  const removeBidFromUI = (bidId) => {
    setBids(prev => prev.filter(b => b.bid_id !== bidId));
    setActionLoading(null);
  };

  const handleCancelOrder = () => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setTimeout(() => {
                Alert.alert('Mock Cancelled', 'Order was cancelled.');
              }, 500);
            } catch (e) {
              Alert.alert("Error", "Could not cancel order");
            }
          }
        }
      ]
    );
  };

  const renderBid = ({ item }) => (
    <View style={styles.bidCard}>
      <View style={styles.bidHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.avatar}><User size={20} color="#fff" /></View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.supplierName} numberOfLines={1}>{item.supplier_name}</Text>
            <Text style={styles.ratingText}>⭐ {item.supplier_rating || '5.0'}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.priceText}>PKR {item.bid_price}</Text>

      <View style={styles.bidActions}>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.bid_id)}>
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>

        <View style={{ flex: 1.5, marginLeft: 8 }}>
          <BidTimerButton
            bid={item}
            onAccept={handleAccept}
            onTimeout={removeBidFromUI}
          />
        </View>
      </View>
    </View>
  );

  if (loading || !orderDetails) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066ff" />
        <Text style={{ marginTop: 10, color: '#666' }}>Setting up arena...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Area */}
      <View style={styles.mapArea}>
        <MapPin size={48} color="#0066ff" opacity={0.5} />
        <Text style={styles.mapText}>Locating Suppliers In Your Area</Text>

        {/* Floating Cancel Button */}
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder}>
          <X size={24} color="#fff" />
        </TouchableOpacity>

        {/* Bids Overlay within the Map */}
        <View style={styles.bidsOverlay}>
          {bids.length > 0 && (
            <FlatList
              data={bids}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.bid_id.toString()}
              renderItem={renderBid}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          )}
        </View>
      </View>

      {/* Order Details Bottom Sheet */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Your Order Request</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location</Text>
          <Text style={styles.detailValue} numberOfLines={2}>{orderDetails.delivery_location || 'Not Set'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Capacity</Text>
          <Text style={styles.detailValue}>{orderDetails.requested_capacity} Gal</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Stated Price</Text>
          <Text style={styles.detailValue}>PKR {orderDetails.customer_bid_price}</Text>
        </View>

        {bids.length === 0 && (
          <View style={styles.waitingContainer}>
            <ActivityIndicator color="#0066ff" size="small" style={{ marginRight: 8 }} />
            <Text style={styles.waitingText}>Listening for offers...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  mapArea: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mapText: { fontSize: 16, fontWeight: 'bold', color: '#64748b', marginTop: 8 },
  cancelBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#ef4444',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4
  },

  bidsOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },
  bidCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: 280,
    marginRight: 16,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4
  },
  bidHeader: { marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#bbb', justifyContent: 'center', alignItems: 'center' },
  supplierName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a', maxWidth: 180 },
  ratingText: { fontSize: 12, color: '#f5a623', marginTop: 2 },
  priceText: { fontSize: 22, fontWeight: 'bold', color: '#0066ff', marginBottom: 12 },

  bidActions: { flexDirection: 'row', alignItems: 'center' },
  rejectBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' },
  rejectText: { color: '#ef4444', fontWeight: 'bold' },

  acceptBtnContainer: { flex: 1, height: 44, borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: '#e2e8f0' },
  acceptBtnBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#94a3b8' },
  acceptBtnBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0066ff' },
  acceptText: { position: 'absolute', width: '100%', textAlign: 'center', lineHeight: 44, color: '#fff', fontWeight: 'bold', fontSize: 15 },

  detailsCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8
  },
  detailsTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  detailLabel: { fontSize: 15, color: '#666', flex: 1 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#333', flex: 2, textAlign: 'right' },

  waitingContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: '#f0f5ff', borderRadius: 8 },
  waitingText: { fontSize: 14, fontWeight: 'bold', color: '#0066ff' }
});
