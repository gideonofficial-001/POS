// User Types
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  OVERALL_MANAGER = 'OVERALL_MANAGER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  branchId?: string;
  branch?: Branch;
  createdAt: string;
  updatedAt: string;
}

// Branch Types
export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product Types
export enum ProductType {
  LPG_REFILL = 'LPG_REFILL',
  LPG_CYLINDER = 'LPG_CYLINDER',
  ELECTRONICS = 'ELECTRONICS',
  ACCESSORIES = 'ACCESSORIES',
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description?: string;
  type: ProductType;
  price: number;
  costPrice?: number;
  cylinderSize?: string;
  brand?: string;
  minStockLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Inventory Types
export interface Inventory {
  id: string;
  branchId: string;
  branch?: Branch;
  productId: string;
  product: Product;
  quantity: number;
  fullCylinders?: number;
  emptyCylinders?: number;
  totalRefilled: number;
  totalSold: number;
  lastRestocked?: string;
  isLowStock?: boolean;
}

// Sale Types
export enum SaleType {
  CASH = 'CASH',
  INVOICE = 'INVOICE',
}

export enum SaleStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export interface SaleItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  isRefill: boolean;
}

export interface Sale {
  id: string;
  saleCode: string;
  branchId: string;
  branch?: Branch;
  userId: string;
  user?: User;
  type: SaleType;
  status: SaleStatus;
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: SaleItem[];
  saleDate: string;
  notes?: string;
  createdAt: string;
}

// Invoice Types
export enum InvoiceStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export interface Invoice {
  id: string;
  invoiceCode: string;
  branchId: string;
  branch?: Branch;
  userId: string;
  user?: User;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  smsSent: boolean;
  smsSentAt?: string;
  sale?: Sale;
  notes?: string;
  createdAt: string;
}

// Return Types
export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
}

export interface Return {
  id: string;
  returnCode: string;
  saleId: string;
  sale?: Sale;
  userId: string;
  user?: User;
  reason: string;
  amount: number;
  status: ReturnStatus;
  approvedById?: string;
  approvedAt?: string;
  rejectionReason?: string;
  stockReversed: boolean;
  createdAt: string;
}

// Device Types
export enum DeviceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REVOKED = 'REVOKED',
}

export interface Device {
  id: string;
  userId: string;
  fingerprint: string;
  deviceInfo: string;
  ipAddress: string;
  status: DeviceStatus;
  approvedById?: string;
  approvedAt?: string;
  lastUsedAt: string;
  createdAt: string;
}

// Audit Log Types
export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SALE_CREATED = 'SALE_CREATED',
  SALE_COMPLETED = 'SALE_COMPLETED',
  SALE_RETURNED = 'SALE_RETURNED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_PAID = 'INVOICE_PAID',
  STOCK_ADJUSTED = 'STOCK_ADJUSTED',
  STOCK_RESTOCKED = 'STOCK_RESTOCKED',
  DEVICE_REGISTERED = 'DEVICE_REGISTERED',
  DEVICE_APPROVED = 'DEVICE_APPROVED',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  BRANCH_CREATED = 'BRANCH_CREATED',
  BRANCH_UPDATED = 'BRANCH_UPDATED',
}

export interface AuditLog {
  id: string;
  userId?: string;
  user?: User;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Dashboard Types
export interface DashboardStats {
  totalSales: number;
  totalAmount: number;
  cashSales: number;
  invoiceSales: number;
  lpgRefills: number;
  lpgCylinders: number;
  electronics: number;
}

export interface NotificationCounts {
  pendingReturns: number;
  pendingDevices: number;
  pendingInvoices: number;
  lowStockItems: number;
  discrepancies: number;
  total: number;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
  deviceFingerprint: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
  requiresDeviceAuth?: boolean;
  deviceRequestId?: string;
  message?: string;
}
