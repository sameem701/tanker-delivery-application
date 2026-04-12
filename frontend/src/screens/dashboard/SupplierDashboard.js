import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../state/AuthContext';

import SupplierMarketplace from '../supplier/SupplierMarketplace';
import SupplierActiveOrders from '../supplier/SupplierActiveOrders';
import SupplierDrivers from '../supplier/SupplierDrivers';

const TABS = ['Market', 'Active', 'Drivers'];

export default function SupplierDashboard() {
  const { userToken } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('Market');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Segmented top tab bar */}
      <View style={styles.tabContainer}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        {activeTab === 'Market'   && <SupplierMarketplace  token={userToken} />}
        {activeTab === 'Active'   && <SupplierActiveOrders token={userToken} />}
        {activeTab === 'Drivers'  && <SupplierDrivers      token={userToken} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#1a1a1a' },
  tabContainer:     { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  tabButton:        { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  tabButtonActive:  { backgroundColor: '#333' },
  tabText:          { color: '#888', fontWeight: 'bold' },
  tabTextActive:    { color: '#fff' },
  content:          { flex: 1, backgroundColor: '#f4f6f8', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
});
