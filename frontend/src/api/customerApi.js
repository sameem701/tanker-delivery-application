import { apiRequest } from './client';

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

export function cancelCustomerOrder(token, orderId) {
    return apiRequest(`/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        token,
    });
}
