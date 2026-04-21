import { apiRequest } from './client';

export function getCurrentDriverOrder(token) {
    return apiRequest('/driver/orders/current', {
        method: 'GET',
        token,
    });
}

export function getDriverOrderDetails(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/details`, {
        method: 'GET',
        token,
    });
}

export function acceptDriverOrder(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/accept`, {
        method: 'POST',
        token,
    });
}

export function rejectDriverOrder(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/reject`, {
        method: 'POST',
        token,
    });
}

export function startDriverRide(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/start-ride`, {
        method: 'POST',
        token,
    });
}

export function markDriverReached(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/reached`, {
        method: 'POST',
        token,
    });
}

export function finishDriverOrder(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/finish`, {
        method: 'POST',
        token,
    });
}

export function cancelDriverOrder(token, orderId) {
    return apiRequest(`/driver/orders/${orderId}/cancel`, {
        method: 'POST',
        token,
    });
}

export function listDriverHistory(token) {
    return apiRequest('/driver/history', {
        method: 'GET',
        token,
    });
}

export function getDriverHistoryDetails(token, orderId) {
    return apiRequest(`/driver/history/${orderId}`, {
        method: 'GET',
        token,
    });
}
