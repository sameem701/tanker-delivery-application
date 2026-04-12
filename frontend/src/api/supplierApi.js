import { apiRequest } from './client';

export function listAvailableOrders(token) {
    return apiRequest('/supplier/orders/available', {
        method: 'GET',
        token,
    });
}

export function placeSupplierBid(token, orderId, bidPrice) {
    return apiRequest(`/supplier/orders/${orderId}/bids`, {
        method: 'POST',
        token,
        body: { bid_price: bidPrice },
    });
}

export function listActiveSupplierOrders(token) {
    return apiRequest('/supplier/orders/active', {
        method: 'GET',
        token,
    });
}

export function listSupplierPastOrders(token) {
    return apiRequest('/supplier/history', {
        method: 'GET',
        token,
    });
}

export function listSupplierDrivers(token) {
    return apiRequest('/supplier/drivers', {
        method: 'GET',
        token,
    });
}

export function addSupplierDriver(token, driverPhoneNum) {
    return apiRequest('/supplier/drivers/add', {
        method: 'POST',
        token,
        body: { driver_phone_num: driverPhoneNum },
    });
}

export function removeSupplierDriver(token, driverPhoneNum) {
    return apiRequest('/supplier/drivers/remove', {
        method: 'DELETE',
        token,
        body: { driver_phone_num: driverPhoneNum },
    });
}
