import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getCustomerQuantityPricing,
  startCustomerOrder,
  cancelCustomerOrder,
  getCustomerOpenOrder,
  listCustomerOrderBids,
  updateCustomerOrderBid,
  acceptCustomerBid,
  rejectCustomerBid
} from '../../api/customerApi';
import BasicButton from '../../components/ui/BasicButton';

const FALLBACK_QUANTITY_PRICING = [
  { quantity_in_gallon: 1000, base_price: 6500 },
  { quantity_in_gallon: 2000, base_price: 10000 },
  { quantity_in_gallon: 3000, base_price: 15000 },
  { quantity_in_gallon: 4000, base_price: 22000 },
  { quantity_in_gallon: 5000, base_price: 25000 },
  { quantity_in_gallon: 6000, base_price: 30000 },
  { quantity_in_gallon: 7000, base_price: 35000 }
];

const CUSTOMER_CANCELABLE_STATUSES = ['open', 'supplier_timer', 'accepted', 'ride_started', 'reached'];
const BID_WINDOW_SECONDS = 15;

export default function CustomerDashboard({ sessionToken }) {
  const [activeOrder, setActiveOrder] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidUpdatePrice, setBidUpdatePrice] = useState('');
  const [quantityPricing, setQuantityPricing] = useState(FALLBACK_QUANTITY_PRICING);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);

  const [address, setAddress] = useState('');
  const [gallons, setGallons] = useState('1000');
  const [price, setPrice] = useState('');

  useEffect(() => {
    const fetchPricing = async () => {
      if (!sessionToken) {
        setLoadingPricing(false);
        return;
      }

      try {
        const response = await getCustomerQuantityPricing(sessionToken);

        const quantities = response?.data?.quantities;
        if (Array.isArray(quantities) && quantities.length > 0) {
          const normalized = quantities.map((item) => ({
            quantity_in_gallon: Number(item.quantity_in_gallon),
            base_price: Number(item.base_price)
          }));
          setQuantityPricing(normalized);
          setGallons(String(normalized[0].quantity_in_gallon));
          setPrice(String(normalized[0].base_price));
        }
      } catch (error) {
        console.log('Quantity pricing fetch failed, using fallback:', error.message);
        setGallons(String(FALLBACK_QUANTITY_PRICING[0].quantity_in_gallon));
        setPrice(String(FALLBACK_QUANTITY_PRICING[0].base_price));
      } finally {
        setLoadingPricing(false);
      }
    };

    fetchPricing();
  }, [sessionToken]);

  const selectedOption = quantityPricing.find((opt) => String(opt.quantity_in_gallon) === gallons);

  const minPrice = selectedOption ? selectedOption.base_price * 0.85 : null;
  const maxPrice = selectedOption ? selectedOption.base_price * 3.0 : null;

  const handleGallonsChange = (value) => {
    setGallons(value);
    const option = quantityPricing.find((opt) => String(opt.quantity_in_gallon) === value);
    if (option) {
      setPrice(String(option.base_price));
    }
  };

  const getRemainingSeconds = (bid) => {
    const directRemaining = Number(bid?.remaining_seconds);
    if (Number.isFinite(directRemaining) && directRemaining >= 0) {
      return Math.floor(directRemaining);
    }

    const now = Date.now();
    if (bid?.expires_at) {
      const expiresAt = new Date(bid.expires_at).getTime();
      if (!Number.isNaN(expiresAt)) {
        return Math.max(0, Math.ceil((expiresAt - now) / 1000));
      }
    }

    if (bid?.created_at) {
      const createdAt = new Date(bid.created_at).getTime();
      if (!Number.isNaN(createdAt)) {
        const expiresAt = createdAt + BID_WINDOW_SECONDS * 1000;
        return Math.max(0, Math.ceil((expiresAt - now) / 1000));
      }
    }

    return 0;
  };

  const hydrateOpenOrder = async (orderId, fallback = {}) => {
    if (!sessionToken) return;
    if (!orderId) return;

    try {
      const response = await getCustomerOpenOrder(sessionToken, Number(orderId));
      const details = response?.data || {};

      const normalized = {
        id: String(details.order_id || orderId),
        address: details.delivery_location || fallback.address || '',
        gallons: String(details.quantity || fallback.gallons || ''),
        price: String(details.customer_bid_price || fallback.price || ''),
        status: details.status || fallback.status || 'open'
      };

      setActiveOrder(normalized);
      setBidUpdatePrice(normalized.price);
    } catch (error) {
      setActiveOrder({
        id: String(orderId),
        address: fallback.address || '',
        gallons: String(fallback.gallons || ''),
        price: String(fallback.price || ''),
        status: fallback.status || 'open'
      });
      setBidUpdatePrice(String(fallback.price || ''));
    }
  };

  const fetchBids = async (orderIdValue) => {
    if (!sessionToken) return;
    if (!orderIdValue) return;

    try {
      setLoadingBids(true);
      const response = await listCustomerOrderBids(sessionToken, Number(orderIdValue));
      const incomingBids = Array.isArray(response?.data?.bids) ? response.data.bids : [];
      setBids(incomingBids.filter((item) => getRemainingSeconds(item) > 0));
    } catch (_error) {
      setBids([]);
    } finally {
      setLoadingBids(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    if (!activeOrder?.id) return;
    if (activeOrder.status !== 'open') return;

    fetchBids(activeOrder.id);

    const interval = setInterval(() => {
      setBids((prev) => prev.filter((item) => getRemainingSeconds(item) > 0));
      fetchBids(activeOrder.id);
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionToken, activeOrder?.id, activeOrder?.status]);

  const handleStartOrder = async () => {
    if (!sessionToken) {
      Alert.alert('Error', 'Missing session token. Please login again.');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }
    if (!gallons) {
      Alert.alert('Error', 'Please select gallons from allowed values');
      return;
    }
    if (!price || Number.isNaN(Number(price))) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    if (selectedOption && minPrice !== null && maxPrice !== null) {
      const numericPrice = Number(price);
      if (numericPrice < minPrice || numericPrice > maxPrice) {
        if (numericPrice < minPrice) {
          Alert.alert(
            'Error',
            `Price cannot be lower than ${minPrice}`
          );
        }
        else if (numericPrice > maxPrice) {
          Alert.alert(
            'Error',
            `Price cannot be higher than ${maxPrice}`
          );
        }
        return;
      }
    }

    try {
      const response = await startCustomerOrder(sessionToken, {
        delivery_location: address.trim(),
        requested_capacity: Number(gallons),
        customer_bid_price: Number(price)
      });

      const newOrderId = response?.data?.order_id;
      await hydrateOpenOrder(newOrderId, {
        address: address.trim(),
        gallons,
        price,
        status: 'open'
      });
    } catch (error) {
      if (error.status === 409 && error?.payload?.data?.active_order_id) {
        await hydrateOpenOrder(error.payload.data.active_order_id, {
          address: address.trim() || 'Existing order',
          gallons,
          price,
          status: error.payload.data.active_order_status || 'active'
        });
        return;
      }

      Alert.alert('Error', error.message || 'Failed to start order');
    }
  };

  const handleCancelOrder = async () => {
    if (!sessionToken) {
      Alert.alert('Error', 'Missing session token. Please login again.');
      return;
    }

    const orderId = Number(activeOrder?.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      Alert.alert('Error', 'Invalid order ID.');
      return;
    }

    if (!CUSTOMER_CANCELABLE_STATUSES.includes(activeOrder?.status)) {
      Alert.alert('Not Allowed', `Order cannot be cancelled in state: ${activeOrder?.status}`);
      return;
    }

    try {
      await cancelCustomerOrder(sessionToken, orderId);
      setActiveOrder(null);
      setBids([]);
      setBidUpdatePrice('');
      Alert.alert('Success', 'Order cancelled successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to cancel order');
    }
  };

  const handleUpdateBid = async () => {
    if (!sessionToken) {
      Alert.alert('Error', 'Missing session token. Please login again.');
      return;
    }

    const orderId = Number(activeOrder?.id);
    const newBid = Number(bidUpdatePrice);
    const currentBid = Number(activeOrder?.price);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      Alert.alert('Error', 'Invalid order ID.');
      return;
    }

    if (!Number.isFinite(newBid) || newBid <= 0) {
      Alert.alert('Error', 'Enter a valid customer bid price');
      return;
    }

    const increment = newBid - currentBid;
    if (increment < 50) {
      Alert.alert('Error', 'Bid update must increase by at least 50');
      return;
    }
    if (increment % 50 !== 0) {
      Alert.alert('Error', 'Bid update must be in increments of 50');
      return;
    }

    try {
      const response = await updateCustomerOrderBid(sessionToken, orderId, newBid);
      const updatedPrice = response?.data?.customer_bid_price;
      setActiveOrder((prev) => ({
        ...prev,
        price: String(updatedPrice || newBid)
      }));
      setBidUpdatePrice(String(updatedPrice || newBid));
      setBids([]);
      Alert.alert('Success', 'Order bid updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update bid');
    }
  };

  const handleAcceptBid = async (bidId, remainingSeconds) => {
    if (!sessionToken) {
      Alert.alert('Error', 'Missing session token. Please login again.');
      return;
    }

    if (remainingSeconds <= 0) {
      Alert.alert('Expired', 'This bid has expired');
      return;
    }

    const orderId = Number(activeOrder?.id);
    try {
      await acceptCustomerBid(sessionToken, orderId, Number(bidId));
      setActiveOrder((prev) => ({ ...prev, status: 'supplier_timer' }));
      setBids([]);
      Alert.alert('Success', 'Bid accepted successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to accept bid');
    }
  };

  const handleRejectBid = async (bidId) => {
    if (!sessionToken) {
      Alert.alert('Error', 'Missing session token. Please login again.');
      return;
    }

    const orderId = Number(activeOrder?.id);
    try {
      await rejectCustomerBid(sessionToken, orderId, Number(bidId));
      setBids((prev) => prev.filter((item) => Number(item.bid_id) !== Number(bidId)));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject bid');
    }
  };

  const visibleBids = bids.filter((item) => getRemainingSeconds(item) > 0);

  if (activeOrder) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '90%', maxWidth: 420 }}>
          <Text>Order Status</Text>
          <Text>Order ID: {activeOrder.id}</Text>
          <Text>Address: {activeOrder.address}</Text>
          <Text>Gallons: {activeOrder.gallons}</Text>
          <Text>Price: {activeOrder.price}</Text>
          <Text>Status: {activeOrder.status}</Text>

          {activeOrder.status === 'open' ? (
            <View>
              <Text>Update Your Bid</Text>
              <TextInput
                value={bidUpdatePrice}
                onChangeText={setBidUpdatePrice}
                keyboardType="numeric"
                style={{ borderWidth: 1 }}
              />
              <Text>Allowed: +50, +100, +150, ...</Text>
              <BasicButton title="Update Bid" onPress={handleUpdateBid} />

              <Text>Incoming Bids</Text>
              {loadingBids ? <Text>Refreshing bids...</Text> : null}
              {visibleBids.length === 0 ? <Text>No live bids right now</Text> : null}
              {visibleBids.map((item) => {
                const remainingSeconds = getRemainingSeconds(item);
                return (
                  <View key={String(item.bid_id)} style={{ borderWidth: 1, marginTop: 8, padding: 8 }}>
                    <Text>Supplier: {item.supplier_name || '-'}</Text>
                    <Text>Bid Price: {item.bid_price}</Text>
                    <Text>Expires In: {remainingSeconds}s</Text>
                    <BasicButton
                      title="Accept"
                      onPress={() => handleAcceptBid(item.bid_id, remainingSeconds)}
                      disabled={remainingSeconds <= 0}
                    />
                    <BasicButton
                      title="Reject"
                      onPress={() => handleRejectBid(item.bid_id)}
                      disabled={remainingSeconds <= 0}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}

          {CUSTOMER_CANCELABLE_STATUSES.includes(activeOrder.status) ? (
            <BasicButton title="Cancel Order" onPress={handleCancelOrder} />
          ) : (
            <Text>Customer cannot cancel in this status.</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '90%', maxWidth: 420 }}>
        <Text>Start A New Order</Text>

        {loadingPricing ? <Text>Loading quantities...</Text> : null}
        {!sessionToken ? <Text>Session missing. Login again to place an order.</Text> : null}

        <Text>Address</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          style={{ borderWidth: 1 }}
        />

        <Text>Gallons</Text>
        <Picker selectedValue={gallons} onValueChange={handleGallonsChange}>
          {quantityPricing.map((option) => (
            <Picker.Item
              key={String(option.quantity_in_gallon)}
              label={String(option.quantity_in_gallon)}
              value={String(option.quantity_in_gallon)}
            />
          ))}
        </Picker>

        <TextInput
          value={gallons}
          editable={false}
          style={{ borderWidth: 1 }}
        />

        <Text>Price Offer</Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          style={{ borderWidth: 1 }}
        />



        <BasicButton title="Start Order" onPress={handleStartOrder} disabled={loadingPricing || !sessionToken} />
      </View>
    </View>
  );
}
