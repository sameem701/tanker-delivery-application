import { apiRequest } from './client';

export function getAvailableOrders(token) {
  return apiRequest('/supplier/orders/available', { method: 'GET', token });
}

export function getAvailableOrderDetails(token, orderId) {
  return apiRequest(`/supplier/orders/available/${orderId}`, { method: 'GET', token });
}

export function getActiveOrders(token) {
  return apiRequest('/supplier/orders/active', { method: 'GET', token });
}

export function placeBid(token, orderId, price) {
  return apiRequest(`/supplier/orders/${orderId}/bids`, { method: 'POST', token, body: { bid_price: parseFloat(price) }});
}




export function assignDriver(token, orderId, driverId) {
  return apiRequest(`/supplier/orders/active/${orderId}/assign-driver`, { method: 'POST', token, body: { driver_id: driverId }});
}

export function listDrivers(token) {
  return apiRequest('/supplier/drivers', { method: 'GET', token });
}

export function addDriver(token, driverPhone) {
  return apiRequest('/supplier/drivers/add', { method: 'POST', token, body: { driver_phone_num: driverPhone }});
}

export function removeDriver(token, driverId) {
  return apiRequest('/supplier/drivers/remove', { method: 'DELETE', token, body: { target_driver_id: driverId, driver_id: driverId }});
}
