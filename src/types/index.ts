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

export enum ProductType {
  LPG_REFILL = 'LPG_REFILL',
  LPG_CYLINDER = 'LPG_CYLINDER',
  ELECTRONICS = 'ELECTRONICS',
  ACCESSORIES = 'ACCESSORIES',
}

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

export enum InvoiceStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum ReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
}

export enum ExpenseCategory {
  FUEL = 'FUEL',
  UTILITIES = 'UTILITIES',
  REPAIRS = 'REPAIRS',
  MISCELLANEOUS = 'MISCELLANEOUS',
  OTHER = 'OTHER',
}

export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum TransferStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum DeviceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REVOKED = 'REVOKED',
}

export enum NotificationType {
  DEVICE_AUTH = 'DEVICE_AUTH',
  RETURN_REQUEST = 'RETURN_REQUEST',
  INVOICE_CREATED = 'INVOICE_CREATED',
  TRANSFER_REQUEST = 'TRANSFER_REQUEST',
  EXPENSE_SUBMITTED = 'EXPENSE_SUBMITTED',
  TRANSFER_APPROVED = 'TRANSFER_APPROVED',
  TRANSFER_REJECTED = 'TRANSFER_REJECTED',
  RETURN_APPROVED = 'RETURN_APPROVED',
  RETURN_REJECTED = 'RETURN_REJECTED',
  EXPENSE_APPROVED = 'EXPENSE_APPROVED',
  EXPENSE_REJECTED = 'EXPENSE_REJECTED',
  LOW_STOCK = 'LOW_STOCK',
  SYSTEM = 'SYSTEM',
}

export enum MovementType {
  SALE = 'SALE',
  RETURN = 'RETURN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  RESTOCK = 'RESTOCK',
  ADJUSTMENT = 'ADJUSTMENT',
  OPENING = 'OPENING',
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: UserRole
  status: UserStatus
  branchId?: string
  branch?: Branch
  lastLoginAt?: string
  createdAt: string
}

export interface Branch {
  id: string
  name: string
  code: string
  address: string
  phone: string
  email?: string
  managerId?: string
  manager?: User
  isActive: boolean
  createdAt: string
}

export interface Product {
  id: string
  name: string
  code: string
  description?: string
  type: ProductType
  categoryId?: string
  category?: ProductCategory
  price: number
  costPrice?: number
  cylinderSize?: string
  brand?: string
  minStockLevel: number
  isActive: boolean
}

export interface ProductCategory {
  id: string
  name: string
  description?: string
  products?: Product[]
}

export interface Inventory {
  id: string
  branchId: string
  branch?: Branch
  productId: string
  product: Product
  quantity: number
  fullCylinders?: number
  emptyCylinders?: number
  minimumQuantity: number
  totalRefilled: number
  totalSold: number
}

export interface Customer {
  id: string
  customerCode: string
  fullName: string
  phone: string
  email?: string
  businessName?: string
  address?: string
  creditLimit: number
  outstandingBalance: number
  isActive: boolean
  isInvoiceEligible: boolean
}

export interface Sale {
  id: string
  saleCode: string
  branchId: string
  branch?: Branch
  userId: string
  user?: User
  customerId?: string
  customer?: Customer
  type: SaleType
  status: SaleStatus
  customerName?: string
  customerPhone?: string
  subtotal: number
  tax: number
  discount: number
  total: number
  items: SaleItem[]
  createdAt: string
}

export interface SaleItem {
  id: string
  productId: string
  product: Product
  quantity: number
  unitPrice: number
  total: number
  isRefill: boolean
}

export interface Invoice {
  id: string
  invoiceCode: string
  branchId: string
  branch?: Branch
  customerId?: string
  customer?: Customer
  customerName: string
  customerPhone: string
  customerEmail?: string
  amount: number
  status: InvoiceStatus
  dueDate: string
  createdAt: string
}

export interface Return {
  id: string
  returnCode: string
  saleId: string
  sale?: Sale
  userId: string
  user?: User
  reason: string
  amount: number
  status: ReturnStatus
  approvedById?: string
  approvedBy?: User
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
}

export interface Expense {
  id: string
  expenseCode: string
  branchId: string
  branch?: Branch
  userId: string
  user?: User
  amount: number
  category: ExpenseCategory
  description: string
  receiptUrl?: string
  status: ExpenseStatus
  approvedById?: string
  approvedBy?: User
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
}

export interface Transfer {
  id: string
  transferCode: string
  fromBranchId: string
  fromBranch?: Branch
  toBranchId: string
  toBranch?: Branch
  initiatedBy: string
  initiator?: User
  approvedById?: string
  approvedBy?: User
  status: TransferStatus
  items: TransferItem[]
  notes?: string
  rejectionReason?: string
  createdAt: string
}

export interface TransferItem {
  id: string
  productId: string
  product: Product
  quantity: number
}

export interface Device {
  id: string
  userId: string
  user?: User
  fingerprint: string
  deviceInfo: string
  ipAddress: string
  status: DeviceStatus
  approvedById?: string
  approvedBy?: User
  approvedAt?: string
  lastUsedAt: string
  createdAt: string
}

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  userId?: string
  entityId?: string
  entityType?: string
  status: 'UNREAD' | 'READ'
  createdAt: string
  readAt?: string
}

export interface ActivityFeedItem {
  id: string
  actorId?: string
  actorName?: string
  branchId?: string
  branchName?: string
  title: string
  message: string
  entityId?: string
  entityType?: string
  actionUrl?: string
  createdAt: string
}

export interface AuditLog {
  id: string
  userId?: string
  user?: User
  action: string
  entityType: string
  entityId?: string
  description: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  createdAt: string
}

export interface CartItem {
  productId: string
  product: Product
  quantity: number
  unitPrice: number
  total: number
}

export interface StockMovement {
  id: string
  inventoryId: string
  productId: string
  branchId: string
  quantityBefore: number
  quantityChanged: number
  quantityAfter: number
  movementType: MovementType
  referenceId?: string
  referenceType?: string
  performedById?: string
  performedBy?: User
  notes?: string
  createdAt: string
}

export interface DashboardStats {
  totalSales: number
  todaySales: number
  totalRevenue: number
  totalBranches: number
  totalProducts: number
  totalUsers: number
  lowStock: number
  pendingInvoices: number
  recentSales: Sale[]
}