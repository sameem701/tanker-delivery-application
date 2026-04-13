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

export function getCustomerOpenOrder(token, orderId) {
    return apiRequest(`/customer/orders/${orderId}/open`, {
        method: 'GET',
        token,
    });
}

export function listCustomerOrderBids(token, orderId) {
    return apiRequest(`/customer/orders/${orderId}/bids`, {
        method: 'GET',
        token,
    });
}

export function updateCustomerOrderBid(token, orderId, customerBidPrice) {
    return apiRequest(`/customer/orders/${orderId}/bid`, {
        method: 'PATCH',
        token,
        body: { customer_bid_price: customerBidPrice },
    });
}

export function acceptCustomerBid(token, orderId, bidId) {
    return apiRequest(`/customer/orders/${orderId}/accept-bid`, {
        method: 'POST',
        token,
        body: { bid_id: bidId },
    });
}

export function rejectCustomerBid(token, orderId, bidId) {
    return apiRequest(`/customer/orders/${orderId}/bids/${bidId}/reject`, {
        method: 'POST',
        token,
    });
}
