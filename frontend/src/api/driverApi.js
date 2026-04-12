import { apiRequest } from './client';

export function getActiveOrder(token) {
  return apiRequest('/driver/orders/active', { method: 'GET', token });
}

export function getOrderDetails(token, orderId) {
  return apiRequest(`/driver/orders/${orderId}/details`, { method: 'GET', token });
}

export function acceptOrder(token, orderId) {
  return apiRequest(`/driver/orders/${orderId}/accept`, { method: 'POST', token });
}

export function rejectOrder(token, orderId) {
  return apiRequest(`/driver/orders/${orderId}/reject`, { method: 'POST', token });
}

export function startRide(token, orderId) {
  return apiRequest(`/driver/orders/${orderId}/start-ride`, { method: 'POST', token });
}

export function markReached(token, orderId) {
  return apiRequest(`/driver/orders/${orderId}/reached`, { method: 'POST', token });
}

export function finishOrder(token, orderId) {
  return apiRequest(`/driver/orders/${orderId}/finish`, { method: 'POST', token });
}

export function getHistory(token) {
  return apiRequest('/driver/history', { method: 'GET', token });
}
