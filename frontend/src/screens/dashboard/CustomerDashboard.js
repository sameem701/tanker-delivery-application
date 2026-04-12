import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getCustomerQuantityPricing, startCustomerOrder, cancelCustomerOrder } from '../../api/customerApi';
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

export default function CustomerDashboard({ sessionToken }) {
  const [activeOrder, setActiveOrder] = useState(null);
  const [quantityPricing, setQuantityPricing] = useState(FALLBACK_QUANTITY_PRICING);
  const [loadingPricing, setLoadingPricing] = useState(true);

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

      setActiveOrder({
        id: String(response?.data?.order_id || ''),
        address: address.trim(),
        gallons,
        price,
        status: 'open'
      });
    } catch (error) {
      if (error.status === 409 && error?.payload?.data?.active_order_id) {
        setActiveOrder({
          id: String(error.payload.data.active_order_id),
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
      Alert.alert('Success', 'Order cancelled successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to cancel order');
    }
  };

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
