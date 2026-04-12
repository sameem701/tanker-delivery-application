import { apiRequest } from './client';

export function startup(token) {
  return apiRequest('/app/startup', { method: 'GET', token });
}

export function enterNumber(phone) {
  return apiRequest('/app/enter-number', {
    method: 'POST',
    body: { phone_number: phone },
  });
}

export function storeOtp(phone, otp) {
  return apiRequest('/app/store-otp', {
    method: 'POST',
    body: {
      phone_number: phone,
      otp,
    },
  });
}

export function verifyOtp(phone, otpCode) {
  return apiRequest('/app/verify-otp', {
    method: 'POST',
    body: {
      phone_number: phone,
      otp: otpCode,
    },
  });
}

export function submitCustomerDetails(token, payload) {
  // Route: /api/customer/enter-details (different base path)
  return apiRequest('/customer/enter-details', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function submitDriverDetails(token, payload) {
  // Route: /api/driver/enter-details (different base path)
  return apiRequest('/driver/enter-details', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function submitSupplierDetails(token, payload) {
  // Route: /api/supplier/enter-details (different base path)
  return apiRequest('/supplier/enter-details', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function getCustomerQuantityPricing(token) {
  return apiRequest('/customer/orders/quantities', {
    method: 'GET',
    token,
  });
}

export function startCustomerOrder(token, payload) {
  return apiRequest('/customer/orders/start', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function getCustomerOrderHistory(token) {
  return apiRequest('/customer/history', {
    method: 'GET',
    token,
  });
}

export function logoutCustomer(token) {
  return apiRequest('/customer/logout', {
    method: 'POST',
    token,
  });
}
