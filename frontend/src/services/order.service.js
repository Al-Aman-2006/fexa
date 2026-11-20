import axiosInstance from "../api/axiosInstance.js";

/**
 * Order Service
 * Handles customer order placement, order history, order cancellation, secure invoice download, and customer return requests.
 */

export const createOrder = async (orderData) => {
  const response = await axiosInstance.post("/api/orders", orderData);
  return response.data;
};

export const getMyOrders = async (params = {}) => {
  const response = await axiosInstance.get("/api/orders", { params });
  return response.data;
};

export const getOrderById = async (id) => {
  const response = await axiosInstance.get(`/api/orders/${id}`);
  return response.data;
};

export const cancelOrder = async (orderId, reason = "") => {
  const payload = typeof reason === "object" ? reason : { reason };
  const response = await axiosInstance.post(`/api/orders/${orderId}/cancel`, payload);
  return response.data;
};

export const cancelOrderItem = async (orderId, itemId, reason = "") => {
  const payload = typeof reason === "object" ? reason : { reason };
  const response = await axiosInstance.post(`/api/orders/${orderId}/items/${itemId}/cancel`, payload);
  return response.data;
};

export const requestItemReturn = async (orderId, itemId, payload = {}) => {
  const response = await axiosInstance.post(`/api/orders/${orderId}/items/${itemId}/return`, payload);
  return response.data;
};

export const downloadInvoice = async (orderId) => {
  const response = await axiosInstance.get(`/api/orders/${orderId}/invoice`, {
    responseType: "blob",
  });
  return response.data;
};

// Customer Return Endpoints
export const getEligibleReturnItems = async () => {
  const response = await axiosInstance.get("/api/returns/eligible-items");
  return response.data;
};

export const createReturnRequest = async (returnData) => {
  const response = await axiosInstance.post("/api/returns", returnData);
  return response.data;
};

export const getCustomerReturns = async (params = {}) => {
  const response = await axiosInstance.get("/api/returns", { params });
  return response.data;
};

export const getCustomerReturnById = async (id) => {
  const response = await axiosInstance.get(`/api/returns/${id}`);
  return response.data;
};

export const orderService = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  cancelOrderItem,
  requestItemReturn,
  downloadInvoice,
  getEligibleReturnItems,
  createReturnRequest,
  getCustomerReturns,
  getCustomerReturnById,
};

export default orderService;
