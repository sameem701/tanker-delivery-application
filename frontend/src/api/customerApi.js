import { apiRequest } from './client';

export function getActiveOrder(token) {
  return apiRequest('/customer/orders/active', { method: 'GET', token });
}

export function getQuantities(token) {
  return apiRequest('/customer/orders/quantities', { method: 'GET', token });
}

export function startOrder(token, payload) {
  return apiRequest('/customer/orders/start', { method: 'POST', token, body: payload });
}

export function getOpenOrder(token, orderId) {
  return apiRequest(`/customer/orders/${orderId}/open`, { method: 'GET', token });
}

export function getOrderBids(token, orderId) {
  return apiRequest(`/customer/orders/${orderId}/bids`, { method: 'GET', token });
}

export function cancelOrder(token, orderId) {
  return apiRequest(`/customer/orders/${orderId}/cancel`, { method: 'POST', token });
}

export function acceptBid(token, orderId, bidId) {
  return apiRequest(`/customer/orders/${orderId}/accept-bid`, { method: 'POST', token, body: { bid_id: bidId } });
}

export function rejectBid(token, orderId, bidId) {
  return apiRequest(`/customer/orders/${orderId}/bids/${bidId}/reject`, { method: 'POST', token });
}

export function getOrderDetails(token, orderId) {
  return apiRequest(`/customer/orders/${orderId}/details`, { method: 'GET', token });
}

export function submitRating(token, orderId, rating) {
  return apiRequest(`/customer/orders/${orderId}/rating`, { method: 'POST', token, body: { rating: rating } });
}

export function getHistory(token) {
  return apiRequest('/customer/history', { method: 'GET', token });
}
