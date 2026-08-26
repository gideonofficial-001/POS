import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, CartItem, Product } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'njugush-auth' },
  ),
)

interface CartState {
  items: CartItem[]
  customerName: string
  customerPhone: string
  discount: number
  addItem: (product: Product, quantity: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  setCustomerInfo: (name: string, phone: string) => void
  setDiscount: (discount: number) => void
  clearCart: () => void
  getSubtotal: () => number
  getTotal: () => number
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  customerName: '',
  customerPhone: '',
  discount: 0,
  addItem: (product, quantity) => {
    const items = get().items
    const existing = items.find((item) => item.productId === product.id)
    if (existing) {
      set({
        items: items.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.unitPrice }
            : item,
        ),
      })
    } else {
      set({
        items: [...items, { productId: product.id, product, quantity, unitPrice: product.price, total: product.price * quantity }],
      })
    }
  },
  removeItem: (productId) => set({ items: get().items.filter((item) => item.productId !== productId) }),
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter((item) => item.productId !== productId) })
    } else {
      set({
        items: get().items.map((item) =>
          item.productId === productId ? { ...item, quantity, total: quantity * item.unitPrice } : item,
        ),
      })
    }
  },
  setCustomerInfo: (name, phone) => set({ customerName: name, customerPhone: phone }),
  setDiscount: (discount) => set({ discount }),
  clearCart: () => set({ items: [], customerName: '', customerPhone: '', discount: 0 }),
  getSubtotal: () => get().items.reduce((sum, item) => sum + item.total, 0),
  getTotal: () => {
    const subtotal = get().items.reduce((sum, item) => sum + item.total, 0)
    return Math.max(0, subtotal - get().discount)
  },
}))

interface SidebarState {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  toggleMobile: () => void
  setMobileOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarState>()((set, get) => ({
  collapsed: false,
  mobileOpen: false,
  toggleCollapsed: () => set({ collapsed: !get().collapsed }),
  toggleMobile: () => set({ mobileOpen: !get().mobileOpen }),
  setMobileOpen: (open) => set({ mobileOpen: open }),
}))

interface NotificationState {
  unreadCount: number
  setUnreadCount: (count: number) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}))