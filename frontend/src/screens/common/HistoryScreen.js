import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../state/AuthContext';
import { apiRequest } from '../../api/client';
import { MapPin, Calendar, Clock, DollarSign, PackageCheck } from 'lucide-react-native';

export default function HistoryScreen() {
  const { userToken, userRole } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // Mocked history response
      setTimeout(() => {
        setHistory([
          { order_id: 1, customer_name: 'Mock Customer', supplier_name: 'Mock Supplier', driver_name: 'Mock Driver', price: 50, item: '10KL Water', created_at: new Date().toISOString() }
        ]);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.log('Error fetching history:', error);
      if (loading) setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    // Determine target name based on who is looking
    let targetEntity = 'N/A';
    if (userRole === 'customer') targetEntity = item.supplier_name || item.driver_name;
    if (userRole === 'supplier') targetEntity = item.customer_name;
    if (userRole === 'driver') targetEntity = item.customer_name;

    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
    const timeStr = item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Order #{item.history_id || item.order_id}</Text>
          <Text style={[styles.badge, item.final_status === 'cancelled' && styles.badgeCancelled]}>
            {item.final_status ? item.final_status.toUpperCase() : 'FINISHED'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Calendar size={16} color="#666" style={{ marginRight: 8 }} />
          <Text style={styles.detailText}>{dateStr} • {timeStr}</Text>
        </View>
        <View style={styles.detailRow}>
          <PackageCheck size={16} color="#666" style={{ marginRight: 8 }} />
          <Text style={styles.detailText}>{targetEntity}</Text>
        </View>
        <View style={styles.detailRow}>
          <DollarSign size={16} color="#666" style={{ marginRight: 8 }} />
          <Text style={styles.detailText}>PKR {item.final_price || item.bid_price || 'N/A'}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.headerTitle}>Order History</Text>
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Clock size={48} color="#ccc" />
          <Text style={styles.emptyText}>You have no past orders.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => (item.history_id || item.order_id || Math.random()).toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', padding: 16, paddingBottom: 8, color: '#1a1a1a' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { textAlign: 'center', marginTop: 16, color: '#666', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  badge: { backgroundColor: '#e6f4ea', color: '#1e8e3e', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  badgeCancelled: { backgroundColor: '#fce8e6', color: '#d93025' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailText: { fontSize: 14, color: '#444' }
});
