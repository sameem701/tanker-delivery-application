import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getCustomerQuantityPricing,
  startCustomerOrder,
  cancelCustomerOrder,
  getCurrentCustomerOrder,
  listCustomerOrderBids,
  updateCustomerOrderBid,
  acceptCustomerBid,
  rejectCustomerBid,
  listCustomerHistory,
  getCustomerHistoryDetails,
  submitCustomerRating,
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

const KARACHI_AREAS = [
  'Buffer Zone',
  'North Nazimabad',
  'Gulberg',
  'Gulshan-e-Iqbal',
  'Clifton',
  'DHA',
  'Johar',
  'Korangi',
  'Malir',
  'Landhi',
  'Nazimabad',
  'Federal B Area',
  'Saddar',
  'PECHS',
  'Defence',
  'Shahrah-e-Faisal'
];

const CUSTOMER_CANCELABLE_STATUSES = ['open', 'supplier_timer', 'accepted', 'ride_started', 'reached'];
const CUSTOMER_TRACKED_STATUSES = ['supplier_timer', 'accepted', 'ride_started', 'reached'];
const BID_WINDOW_SECONDS = 15;

export default function CustomerDashboard({ sessionToken }) {
  const [activeOrder, setActiveOrder] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidUpdatePrice, setBidUpdatePrice] = useState('');
  const [quantityPricing, setQuantityPricing] = useState(FALLBACK_QUANTITY_PRICING);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);
  const [loadingCurrentOrder, setLoadingCurrentOrder] = useState(true);

  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState(KARACHI_AREAS[0]);
  const [gallons, setGallons] = useState('1000');
  const [price, setPrice] = useState('');

  const [activeTab, setActiveTab] = useState('order'); // order | history
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Rating prompt modal (shown automatically when a completed unrated order is detected)
  const [ratingPromptOrder, setRatingPromptOrder] = useState(null);
  const [promptRating, setPromptRating] = useState(null);
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  // Session-only dismissed set — cleared when app closes/restarts
  const dismissedRatingIds = useRef(new Set());

  const formatDuration = (secondsRaw) => {
    const totalSeconds = Math.max(0, Number(secondsRaw || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getRemainingSupplierSeconds = (order) => {
    const directRemaining = Number(order?.remaining_supplier_seconds);
    if (Number.isFinite(directRemaining) && directRemaining >= 0) {
      return Math.floor(directRemaining);
    }

    if (!order?.time_limit_for_supplier) {
      return 0;
    }

    const timeLimit = new Date(order.time_limit_for_supplier).getTime();
    if (Number.isNaN(timeLimit)) {
      return 0;
    }

    return Math.max(0, Math.ceil((timeLimit - Date.now()) / 1000));
  };

  const normalizeOrder = (details, fallback = {}) => ({
    id: String(details?.order_id || fallback.id || ''),
    address: details?.delivery_location || fallback.address || '',
    gallons: String(details?.quantity || details?.requested_capacity || fallback.gallons || ''),
    price: String(
      details?.status === 'open'
        ? details?.customer_bid_price ?? fallback.price ?? ''
        : details?.accepted_price ?? fallback.price ?? ''
    ),
    status: details?.status || fallback.status || 'open',
    awaiting_rating: details?.awaiting_rating || false,
    time_limit_for_supplier: details?.time_limit_for_supplier || null,
    remaining_supplier_seconds: details?.remaining_supplier_seconds,
    supplier_name: details?.supplier_name || null,
    supplier_business_contact: details?.supplier_business_contact || null,
    supplier_yard_location: details?.supplier_yard_location || null,
    driver_name: details?.driver_name || null,
    driver_phone: details?.driver_phone || null
  });

  const loadCurrentOrder = useCallback(async () => {
    if (!sessionToken) {
      setActiveOrder(null);
      setBids([]);
      setBidUpdatePrice('');
      return;
    }

    try {
      const response = await getCurrentCustomerOrder(sessionToken);
      const normalized = normalizeOrder(response?.data || {});
      setActiveOrder(normalized);

      if (normalized.status === 'open') {
        setBidUpdatePrice(normalized.price || '');
      } else {
        setBids([]);
      }
    } catch (error) {
      if (error.status === 404 || error.status === 410) {
        setActiveOrder(null);
        setBids([]);
        setBidUpdatePrice('');
        return;
      }

      console.log('Current order fetch failed:', error.message);
    }
  }, [sessionToken]);

  useEffect(() => {
    let mounted = true;

    const bootstrapCurrentOrder = async () => {
      if (!sessionToken) {
        setLoadingCurrentOrder(false);
        return;
      }

      setLoadingCurrentOrder(true);
      await loadCurrentOrder();
      if (mounted) {
        setLoadingCurrentOrder(false);
      }
    };

    bootstrapCurrentOrder();

    return () => {
      mounted = false;
    };
  }, [sessionToken, loadCurrentOrder]);

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

  useEffect(() => {
    if (!sessionToken) return;
    if (!activeOrder?.id) return;
    if (!CUSTOMER_TRACKED_STATUSES.includes(activeOrder.status)) return;

    const intervalId = setInterval(() => {
      loadCurrentOrder();
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sessionToken, activeOrder?.id, activeOrder?.status, loadCurrentOrder]);

  const handleStartOrder = async () => {
    if (!sessionToken) {
      Alert.alert('Error', 'Missing session token. Please login again.');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }
    if (!district) {
      Alert.alert('Error', 'Please select a district');
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
      await startCustomerOrder(sessionToken, {
        delivery_location: `${address.trim()}, ${district}`,
        requested_capacity: Number(gallons),
        customer_bid_price: Number(price)
      });
      await loadCurrentOrder();
    } catch (error) {
      if (error.status === 409 && error?.payload?.data?.active_order_id) {
        await loadCurrentOrder();
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
      await loadCurrentOrder();
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

  const fetchHistory = async () => {
    if (!sessionToken) return;
    try {
      setLoadingHistory(true);
      const response = await listCustomerHistory(sessionToken);
      setHistoryOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchHistoryDetail = async (orderId) => {
    if (!sessionToken) return;
    try {
      const response = await getCustomerHistoryDetails(sessionToken, orderId);
      setHistoryDetail({ order_id: orderId, ...(response?.data || {}) });
      setSelectedRating(null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load order details');
    }
  };

  const handleSubmitRating = async () => {
    if (!sessionToken || !historyDetail || selectedRating == null) return;
    try {
      setRatingSubmitting(true);
      await submitCustomerRating(sessionToken, historyDetail.order_id, selectedRating);
      setHistoryDetail((prev) => ({ ...prev, customer_rating: selectedRating }));
      Alert.alert('Success', 'Rating submitted successfully');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleDismissPrompt = () => {
    if (ratingPromptOrder) {
      dismissedRatingIds.current.add(ratingPromptOrder.order_id);
    }
    setRatingPromptOrder(null);
    setPromptRating(null);
  };

  const handleSubmitPromptRating = async () => {
    if (!sessionToken || !ratingPromptOrder || promptRating == null) return;
    try {
      setPromptSubmitting(true);
      await submitCustomerRating(sessionToken, ratingPromptOrder.order_id, promptRating);
      dismissedRatingIds.current.add(ratingPromptOrder.order_id);
      setRatingPromptOrder(null);
      setPromptRating(null);
      Alert.alert('Thank you!', 'Your rating has been submitted.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit rating');
    } finally {
      setPromptSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'history' || !sessionToken) return;
    fetchHistory();
  }, [activeTab, sessionToken]);

  // On mount: check history for any completed unrated order and prompt
  // (covers the case where the finished order was already rated and archived)

  // When the active order transitions to 'finished', show the rating prompt immediately
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'finished') return;
    if (dismissedRatingIds.current.has(activeOrder.id)) return;
    setRatingPromptOrder({
      order_id: activeOrder.id,
      quantity: activeOrder.gallons,
      price: activeOrder.price,
    });
    setPromptRating(null);
  }, [activeOrder?.status, activeOrder?.id]);

  // When active order is 'finished', show rating prompt immediately (or on re-open)
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'finished') return;
    if (dismissedRatingIds.current.has(activeOrder.id)) return;
    setRatingPromptOrder({
      order_id: activeOrder.id,
      quantity: activeOrder.gallons,
      price: activeOrder.price,
    });
    setPromptRating(null);
  }, [activeOrder?.status, activeOrder?.id]);

  // On mount: check history for any completed unrated order and prompt
  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      try {
        const histRes = await listCustomerHistory(sessionToken);
        const orders = Array.isArray(histRes?.data?.orders) ? histRes.data.orders : [];
        const unrated = orders.find(
          (o) => (o.status === 'completed' || o.status === 'finished') && o.customer_rating == null
        );
        if (unrated && !dismissedRatingIds.current.has(unrated.order_id)) {
          setRatingPromptOrder(unrated);
          setPromptRating(null);
        }
      } catch (_e) { /* silent — non-critical */ }
    })();
  }, [sessionToken]);

  const visibleBids = bids.filter((item) => getRemainingSeconds(item) > 0);

  if (loadingCurrentOrder) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '90%', maxWidth: 420 }}>
          <Text>Checking active order...</Text>
        </View>
      </View>
    );
  }

  const supplierTimeLeftSeconds = activeOrder ? getRemainingSupplierSeconds(activeOrder) : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Rating prompt modal */}
      <Modal
        visible={ratingPromptOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={handleDismissPrompt}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '85%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 8, padding: 20 }}>
            <Text style={{ fontSize: 16, marginBottom: 4 }}>Rate Your Delivery</Text>
            <Text style={{ color: '#555', marginBottom: 12 }}>Order #{ratingPromptOrder?.order_id} — {ratingPromptOrder?.quantity} gal @ {ratingPromptOrder?.price}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <BasicButton
                  key={star}
                  title={String(star)}
                  onPress={() => setPromptRating(star)}
                  style={{
                    width: '18%',
                    marginTop: 0,
                    borderWidth: promptRating === star ? 3 : 1,
                  }}
                />
              ))}
            </View>
            <BasicButton
              title={promptSubmitting ? 'Submitting...' : promptRating != null ? `Submit ${promptRating}/5` : 'Select a rating above'}
              onPress={handleSubmitPromptRating}
              disabled={promptRating == null || promptSubmitting}
              style={{ marginTop: 0, marginBottom: 8 }}
            />
            <BasicButton
              title="Not now"
              onPress={handleDismissPrompt}
              style={{ marginTop: 0 }}
            />
          </View>
        </View>
      </Modal>
      {/* Tab bar */}
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <View style={{ width: '90%', maxWidth: 420, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <BasicButton title="Order" onPress={() => setActiveTab('order')} style={{ width: '49%', marginTop: 0 }} />
          <BasicButton title="History" onPress={() => setActiveTab('history')} style={{ width: '49%', marginTop: 0 }} />
        </View>
      </View>

      {activeTab === 'order' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxWidth: 420 }}>
            {activeOrder ? (
              <>
                <Text>Order Status</Text>
                <Text>Order ID: {activeOrder.id}</Text>
                <Text>Address: {activeOrder.address}</Text>
                <Text>Gallons: {activeOrder.gallons}</Text>
                <Text>Price: {activeOrder.price}</Text>
                <Text>Status: {activeOrder.status}</Text>

                {activeOrder.status === 'supplier_timer' ? (
                  <View style={{ borderWidth: 1, marginTop: 8, padding: 8 }}>
                    <Text>Supplier Confirmation Window</Text>
                    <Text>Time Left: {formatDuration(supplierTimeLeftSeconds)}</Text>
                    <Text>Supplier: {activeOrder.supplier_name || '-'}</Text>
                    <Text>Supplier Contact: {activeOrder.supplier_business_contact || '-'}</Text>
                    <Text>Supplier Yard: {activeOrder.supplier_yard_location || '-'}</Text>
                  </View>
                ) : null}

                {(activeOrder.status === 'accepted' || activeOrder.status === 'ride_started' || activeOrder.status === 'reached') ? (
                  <View style={{ borderWidth: 1, marginTop: 8, padding: 8 }}>
                    <Text>Order Progress Details</Text>
                    <Text>Supplier: {activeOrder.supplier_name || '-'}</Text>
                    <Text>Supplier Contact: {activeOrder.supplier_business_contact || '-'}</Text>
                    <Text>Driver: {activeOrder.driver_name || 'Not assigned yet'}</Text>
                    <Text>Driver Phone: {activeOrder.driver_phone || '-'}</Text>
                  </View>
                ) : null}

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
              </>
            ) : (
              <>
                <Text>Start A New Order</Text>
                {loadingPricing ? <Text>Loading quantities...</Text> : null}
                {!sessionToken ? <Text>Session missing. Login again to place an order.</Text> : null}

                <Text>Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  style={{ borderWidth: 1 }}
                />

                <Text>District</Text>
                <Picker selectedValue={district} onValueChange={setDistrict}>
                  {KARACHI_AREAS.map((area) => (
                    <Picker.Item key={area} label={area} value={area} />
                  ))}
                </Picker>

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
              </>
            )}
          </View>
        </View>
      )}

      {activeTab === 'history' && (
        <ScrollView
          style={{ width: '90%', maxWidth: 420, alignSelf: 'center' }}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {historyDetail ? (
            <View style={{ marginTop: 8 }}>
              <BasicButton
                title="← Back to History"
                onPress={() => setHistoryDetail(null)}
                style={{ alignSelf: 'flex-start', marginBottom: 8 }}
              />
              <View style={{ borderWidth: 1, borderColor: '#d0d0d0', borderRadius: 4, padding: 10 }}>
                <Text>Order #{historyDetail.order_id}</Text>
                <Text>Status: {historyDetail.status || '-'}</Text>
                <Text>Date: {historyDetail.order_date || '-'}</Text>
                <Text>Location: {historyDetail.customer_location || '-'}</Text>
                <Text>Gallons: {historyDetail.quantity || '-'}</Text>
                <Text>Price: {historyDetail.price || '-'}</Text>
                <Text>Supplier: {historyDetail.supplier_name || '-'}</Text>
                <Text>Driver: {historyDetail.driver_name || '-'}</Text>
              </View>

              {historyDetail.status === 'completed' ? (
                <View style={{ borderWidth: 1, borderColor: '#d0d0d0', borderRadius: 4, padding: 10, marginTop: 8 }}>
                  <Text>Rate This Delivery</Text>
                  {historyDetail.customer_rating != null ? (
                    <Text>Your rating: {historyDetail.customer_rating}/5</Text>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <BasicButton
                            key={star}
                            title={String(star)}
                            onPress={() => setSelectedRating(star)}
                            style={{
                              width: '18%',
                              marginTop: 0,
                              borderWidth: selectedRating === star ? 2 : 1,
                            }}
                          />
                        ))}
                      </View>
                      {selectedRating != null ? (
                        <BasicButton
                          title={ratingSubmitting ? 'Submitting...' : `Submit Rating`}
                          onPress={handleSubmitRating}
                          disabled={ratingSubmitting}
                          style={{ alignSelf: 'stretch', marginTop: 8 }}
                        />
                      ) : null}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text>Order History</Text>
              <BasicButton
                title="Refresh"
                onPress={fetchHistory}
                style={{ alignSelf: 'stretch', marginTop: 8 }}
              />
              {loadingHistory ? <Text>Loading history...</Text> : null}
              {!loadingHistory && historyOrders.length === 0 ? <Text>No past orders.</Text> : null}
              {historyOrders.map((item) => (
                <View
                  key={String(item.order_id)}
                  style={{ borderWidth: 1, borderColor: '#d0d0d0', borderRadius: 4, padding: 10, marginTop: 8 }}
                >
                  <Text>Order #{item.order_id}</Text>
                  <Text>Status: {item.status || '-'}</Text>
                  <Text>Date: {item.order_date || '-'}</Text>
                  <Text>Qty: {item.quantity || '-'} | Price: {item.price || '-'}</Text>
                  <BasicButton
                    title="View Details"
                    onPress={() => fetchHistoryDetail(item.order_id)}
                    style={{ alignSelf: 'stretch', marginTop: 4 }}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
