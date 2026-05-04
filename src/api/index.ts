import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Generate device fingerprint
export const generateDeviceFingerprint = (): string => {
  const navigatorInfo = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');

  return btoa(navigatorInfo).substring(0, 32);
};

// Auth API
export const authApi = {
  login: (email: string, password: string, deviceFingerprint: string) =>
    apiClient.post('/auth/login', { email, password, deviceFingerprint }),

  requestDeviceCode: (email: string, deviceFingerprint: string) =>
    apiClient.post('/auth/device/request', { email, deviceFingerprint }),

  verifyDeviceCode: (requestId: string, authorizationCode: string) =>
    apiClient.post('/auth/device/verify', { requestId, authorizationCode }),

  logout: () => apiClient.post('/auth/logout'),
};

// Users API
export const usersApi = {
  getAll: () => apiClient.get('/users'),
  getById: (id: string) => apiClient.get(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
  update: (id: string, data: any) => apiClient.patch(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/users/${id}/status?status=${status}`),
};

// Branches API
export const branchesApi = {
  getAll: () => apiClient.get('/branches'),
  getById: (id: string) => apiClient.get(`/branches/${id}`),
  create: (data: any) => apiClient.post('/branches', data),
  update: (id: string, data: any) => apiClient.patch(`/branches/${id}`, data),
  delete: (id: string) => apiClient.delete(`/branches/${id}`),
};

// Products API
export const productsApi = {
  getAll: (type?: string) => apiClient.get('/products', { params: { type } }),
  getLPG: () => apiClient.get('/products/lpg'),
  getById: (id: string) => apiClient.get(`/products/${id}`),
  create: (data: any) => apiClient.post('/products', data),
  update: (id: string, data: any) => apiClient.patch(`/products/${id}`, data),
  delete: (id: string) => apiClient.delete(`/products/${id}`),
};

// Inventory API
export const inventoryApi = {
  getAll: () => apiClient.get('/inventory'),
  getByBranch: (branchId: string) => apiClient.get(`/inventory/branch/${branchId}`),
  getAlerts: () => apiClient.get('/inventory/alerts/low-stock'),
  getReconciliation: (branchId?: string) =>
    apiClient.get('/inventory/reconciliation/cylinders', { params: { branchId } }),
  restock: (data: any) => apiClient.post('/inventory/restock', data),
  adjust: (data: any) => apiClient.post('/inventory/adjust', data),
  transfer: (data: any) => apiClient.post('/inventory/transfer', data),
};

// Sales API
export const salesApi = {
  getAll: (params?: any) => apiClient.get('/sales', { params }),
  getById: (id: string) => apiClient.get(`/sales/${id}`),
  getByCode: (code: string) => apiClient.get(`/sales/code/${code}`),
  create: (data: any) => apiClient.post('/sales', data),
  getDailySummary: (branchId?: string, date?: string) =>
    apiClient.get('/sales/daily-summary', { params: { branchId, date } }),
};

// Invoices API
export const invoicesApi = {
  getAll: (params?: any) => apiClient.get('/invoices', { params }),
  getById: (id: string) => apiClient.get(`/invoices/${id}`),
  create: (data: any) => apiClient.post('/invoices', data),
  markAsPaid: (id: string) => apiClient.patch(`/invoices/${id}/pay`),
  cancel: (id: string) => apiClient.patch(`/invoices/${id}/cancel`),
};

// Returns API
export const returnsApi = {
  getAll: (params?: any) => apiClient.get('/returns', { params }),
  getById: (id: string) => apiClient.get(`/returns/${id}`),
  create: (data: any) => apiClient.post('/returns', data),
  approve: (id: string) => apiClient.patch(`/returns/${id}/approve`),
  reject: (id: string, reason: string) =>
    apiClient.patch(`/returns/${id}/reject`, { reason }),
};

// Reports API
export const reportsApi = {
  getSales: (startDate: string, endDate: string, branchId?: string) =>
    apiClient.get('/reports/sales', { params: { startDate, endDate, branchId } }),
  getInventory: (branchId?: string) =>
    apiClient.get('/reports/inventory', { params: { branchId } }),
  getCylinderReconciliation: (branchId?: string) =>
    apiClient.get('/reports/cylinder-reconciliation', { params: { branchId } }),
  getUserPerformance: (startDate: string, endDate: string) =>
    apiClient.get('/reports/user-performance', { params: { startDate, endDate } }),
};

// Audit Logs API
export const auditLogsApi = {
  getAll: (params?: any) => apiClient.get('/audit-logs', { params }),
  getByUser: (userId: string) => apiClient.get(`/audit-logs/by-user/${userId}`),
};

// Devices API
export const devicesApi = {
  getPending: () => apiClient.get('/devices/pending'),
  approve: (id: string) => apiClient.post(`/devices/${id}/approve`),
  getMyDevices: () => apiClient.get('/devices/my-devices'),
  revoke: (id: string) => apiClient.post(`/devices/${id}/revoke`),
};

// Notifications API
export const notificationsApi = {
  getDashboard: () => apiClient.get('/notifications/dashboard'),
  sendDailySummary: () => apiClient.post('/notifications/daily-summary'),
};

export default apiClient;
