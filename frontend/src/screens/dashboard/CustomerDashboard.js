import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography, shadow } from '../../theme/tokens';
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
const MIN_BID = 500;
const BID_STEP = 50;

function formatDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

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

  const handleDismissPrompt = async () => {
    if (ratingPromptOrder && sessionToken) {
      dismissedRatingIds.current.add(ratingPromptOrder.order_id);
      try {
        await submitCustomerRating(sessionToken, ratingPromptOrder.order_id, null);
      } catch (_e) { /* silent — best effort skip */ }
    }
    setRatingPromptOrder(null);
    setPromptRating(null);
    setActiveOrder(null);
  };

  const handleSubmitPromptRating = async () => {
    if (!sessionToken || !ratingPromptOrder || promptRating == null) return;
    try {
      setPromptSubmitting(true);
      await submitCustomerRating(sessionToken, ratingPromptOrder.order_id, promptRating);
      dismissedRatingIds.current.add(ratingPromptOrder.order_id);
      setRatingPromptOrder(null);
      setPromptRating(null);
      setActiveOrder(null);
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

  // When active order transitions to 'finished', show rating prompt immediately (or on re-open)
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

  const visibleBids = bids.filter((item) => getRemainingSeconds(item) > 0);
  const minBid = Math.max(MIN_BID, Number(activeOrder?.price) || MIN_BID);

  if (loadingCurrentOrder) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const supplierTimeLeftSeconds = activeOrder ? getRemainingSupplierSeconds(activeOrder) : 0;

  return (
    <View style={styles.container}>
      {/* Rating prompt modal */}
      <Modal
        visible={ratingPromptOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={handleDismissPrompt}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rate Your Delivery</Text>
            <Text style={styles.modalSubtitle}>Order #{ratingPromptOrder?.order_id} — {ratingPromptOrder?.quantity} gal @ {ratingPromptOrder?.price}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <BasicButton
                  key={star}
                  title={String(star)}
                  onPress={() => setPromptRating(star)}
                  selected={promptRating === star}
                  style={styles.starButton}
                />
              ))}
            </View>
            <BasicButton
              title={promptSubmitting ? 'Submitting...' : promptRating != null ? `Submit ${promptRating}/5` : 'Select a rating above'}
              onPress={handleSubmitPromptRating}
              disabled={promptRating == null || promptSubmitting}
              style={styles.modalActionButton}
            />
            <BasicButton
              title="Not now"
              onPress={handleDismissPrompt}
              style={styles.ghostButton}
              textStyle={{ color: colors.textSecondary }}
            />
          </View>
        </View>
      </Modal>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <BasicButton title="Order" selected={activeTab === 'order'} onPress={() => setActiveTab('order')} style={styles.tabButton} />
        <BasicButton title="History" selected={activeTab === 'history'} onPress={() => setActiveTab('history')} style={styles.tabButton} />
      </View>

      {activeTab === 'order' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {activeOrder ? (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Active Order #{activeOrder.id}</Text>
                <Text style={styles.row}><Text style={styles.label}>Address: </Text><Text style={styles.value}>{activeOrder.address}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Gallons: </Text><Text style={styles.value}>{activeOrder.gallons}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Price: </Text><Text style={styles.value}>{activeOrder.price}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Status: </Text><Text style={styles.value}>{activeOrder.status}</Text></Text>
              </View>

              {activeOrder.status === 'supplier_timer' ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Supplier Confirmation Window</Text>
                  <Text style={styles.row}><Text style={styles.label}>Time Left: </Text><Text style={styles.value}>{formatDuration(supplierTimeLeftSeconds)}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Supplier: </Text><Text style={styles.value}>{activeOrder.supplier_name || '-'}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Contact: </Text><Text style={styles.value}>{activeOrder.supplier_business_contact || '-'}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Yard: </Text><Text style={styles.value}>{activeOrder.supplier_yard_location || '-'}</Text></Text>
                </View>
              ) : null}

              {(activeOrder.status === 'accepted' || activeOrder.status === 'ride_started' || activeOrder.status === 'reached') ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Order Progress</Text>
                  <Text style={styles.row}><Text style={styles.label}>Supplier: </Text><Text style={styles.value}>{activeOrder.supplier_name || '-'}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Contact: </Text><Text style={styles.value}>{activeOrder.supplier_business_contact || '-'}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Driver: </Text><Text style={styles.value}>{activeOrder.driver_name || 'Not assigned yet'}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Driver Phone: </Text><Text style={styles.value}>{activeOrder.driver_phone || '-'}</Text></Text>
                </View>
              ) : null}

              {activeOrder.status === 'open' ? (
                <View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Update Your Bid</Text>
                    <Text style={styles.hint}>Current: {activeOrder.price} · Min: {minBid} · Step: {BID_STEP}</Text>
                    <View style={styles.bidUpdateRow}>
                      <BasicButton
                        title="−"
                        onPress={() => setBidUpdatePrice(v => String(Math.max(minBid, (Number(v) || minBid) - BID_STEP)))}
                        disabled={!bidUpdatePrice || Number(bidUpdatePrice) <= minBid}
                        style={styles.bidStepButton}
                      />
                      <TextInput
                        value={bidUpdatePrice}
                        onChangeText={setBidUpdatePrice}
                        keyboardType="numeric"
                        style={styles.bidValueInput}
                        placeholder={String(minBid)}
                        placeholderTextColor={colors.textSecondary}
                      />
                      <BasicButton
                        title="+"
                        onPress={() => setBidUpdatePrice(v => String((Number(v) || minBid) + BID_STEP))}
                        style={styles.bidStepButton}
                      />
                    </View>
                    <BasicButton title="Update Bid" onPress={handleUpdateBid} style={styles.fullButton} />
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Incoming Bids</Text>
                    {loadingBids ? <Text style={styles.hint}>Refreshing bids...</Text> : null}
                    {visibleBids.length === 0 ? <Text style={styles.emptyText}>No live bids right now</Text> : null}
                    {visibleBids.map((item) => {
                      const remainingSeconds = getRemainingSeconds(item);
                      return (
                        <View key={String(item.bid_id)} style={styles.bidCard}>
                          <Text style={styles.row}><Text style={styles.label}>Supplier: </Text><Text style={styles.value}>{item.supplier_name || '-'}</Text></Text>
                          <Text style={styles.row}><Text style={styles.label}>Bid Price: </Text><Text style={styles.value}>{item.bid_price}</Text></Text>
                          <Text style={styles.row}><Text style={styles.label}>Expires In: </Text><Text style={styles.value}>{remainingSeconds}s</Text></Text>
                          <View style={styles.actionRow}>
                            <BasicButton
                              title="Accept"
                              onPress={() => handleAcceptBid(item.bid_id, remainingSeconds)}
                              disabled={remainingSeconds <= 0}
                              style={styles.actionButton}
                            />
                            <BasicButton
                              title="Reject"
                              onPress={() => handleRejectBid(item.bid_id)}
                              disabled={remainingSeconds <= 0}
                              style={[styles.actionButton, styles.dangerButton]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {CUSTOMER_CANCELABLE_STATUSES.includes(activeOrder.status) ? (
                <BasicButton title="Cancel Order" onPress={handleCancelOrder} style={styles.dangerButton} />
              ) : (
                <Text style={styles.hint}>Order cannot be cancelled at this stage.</Text>
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.pageTitle}>Start A New Order</Text>
              {loadingPricing ? <Text style={styles.hint}>Loading quantities...</Text> : null}
              {!sessionToken ? <Text style={styles.errorText}>Session missing. Login again.</Text> : null}

              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  style={styles.input}
                  placeholder="Street address"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>District</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={district} onValueChange={setDistrict}>
                    {KARACHI_AREAS.map((area) => (
                      <Picker.Item key={area} label={area} value={area} />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.fieldLabel}>Gallons</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={gallons} onValueChange={handleGallonsChange}>
                    {quantityPricing.map((option) => (
                      <Picker.Item
                        key={String(option.quantity_in_gallon)}
                        label={String(option.quantity_in_gallon)}
                        value={String(option.quantity_in_gallon)}
                      />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.fieldLabel}>Price Offer</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="Your price offer"
                  placeholderTextColor={colors.textSecondary}
                />

                <BasicButton title="Start Order" onPress={handleStartOrder} disabled={loadingPricing || !sessionToken} style={styles.fullButton} />
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'history' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {historyDetail ? (
            <View>
              <BasicButton
                title="← Back"
                onPress={() => setHistoryDetail(null)}
                style={styles.backButton}
              />
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Order #{historyDetail.order_id}</Text>
                <Text style={styles.row}><Text style={styles.label}>Status: </Text><Text style={styles.value}>{historyDetail.status || '-'}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Date: </Text><Text style={styles.value}>{formatDate(historyDetail.order_date)}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Location: </Text><Text style={styles.value}>{historyDetail.customer_location || '-'}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Gallons: </Text><Text style={styles.value}>{historyDetail.quantity || '-'}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Price: </Text><Text style={styles.value}>{historyDetail.price || '-'}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Supplier: </Text><Text style={styles.value}>{historyDetail.supplier_name || '-'}</Text></Text>
                <Text style={styles.row}><Text style={styles.label}>Driver: </Text><Text style={styles.value}>{historyDetail.driver_name || '-'}</Text></Text>
              </View>

              {historyDetail.status === 'completed' ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Rate This Delivery</Text>
                  {historyDetail.customer_rating != null ? (
                    <Text style={styles.value}>Your rating: {historyDetail.customer_rating}/5 ⭐</Text>
                  ) : (
                    <View>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <BasicButton
                            key={star}
                            title={String(star)}
                            onPress={() => setSelectedRating(star)}
                            selected={selectedRating === star}
                            style={styles.starButton}
                          />
                        ))}
                      </View>
                      {selectedRating != null ? (
                        <BasicButton
                          title={ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
                          onPress={handleSubmitRating}
                          disabled={ratingSubmitting}
                          style={styles.fullButton}
                        />
                      ) : null}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              <Text style={styles.pageTitle}>Order History</Text>
              <BasicButton title="Refresh" onPress={fetchHistory} style={styles.fullButton} />
              {loadingHistory ? <Text style={styles.hint}>Loading history...</Text> : null}
              {!loadingHistory && historyOrders.length === 0 ? <Text style={styles.emptyText}>No past orders yet.</Text> : null}
              {historyOrders.map((item) => (
                <View key={String(item.order_id)} style={styles.card}>
                  <Text style={styles.cardTitle}>Order #{item.order_id}</Text>
                  <Text style={styles.row}><Text style={styles.label}>Status: </Text><Text style={styles.value}>{item.status || '-'}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Date: </Text><Text style={styles.value}>{formatDate(item.order_date)}</Text></Text>
                  <Text style={styles.row}><Text style={styles.label}>Qty: </Text><Text style={styles.value}>{item.quantity || '-'}</Text><Text style={styles.label}> | Price: </Text><Text style={styles.value}>{item.price || '-'}</Text></Text>
                  <BasicButton
                    title="View Details"
                    onPress={() => fetchHistoryDetail(item.order_id)}
                    style={styles.fullButton}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    marginTop: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  pageTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  cardTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  bidCard: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  label: {
    fontSize: typography.label,
    color: colors.textSecondary,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  hint: {
    fontSize: typography.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  errorText: {
    fontSize: typography.label,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.label,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fullButton: {
    marginTop: spacing.sm,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    marginTop: 0,
  },
  bidUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bidStepButton: {
    width: 44,
    height: 44,
    marginTop: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: radius.sm,
  },
  bidValueInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
    gap: 4,
  },
  starButton: {
    flex: 1,
    marginTop: 0,
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '88%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  modalTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalActionButton: {
    marginTop: spacing.xs,
  },
});
