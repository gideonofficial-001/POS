import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, NotificationCounts, Branch, Product } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface NotificationState {
  counts: NotificationCounts;
  setCounts: (counts: NotificationCounts) => void;
  incrementCount: (key: keyof NotificationCounts) => void;
  decrementCount: (key: keyof NotificationCounts) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  counts: {
    pendingReturns: 0,
    pendingDevices: 0,
    pendingInvoices: 0,
    lowStockItems: 0,
    discrepancies: 0,
    total: 0,
  },
  setCounts: (counts) => set({ counts }),
  incrementCount: (key) =>
    set((state) => ({
      counts: {
        ...state.counts,
        [key]: state.counts[key] + 1,
        total: state.counts.total + 1,
      },
    })),
  decrementCount: (key) =>
    set((state) => ({
      counts: {
        ...state.counts,
        [key]: Math.max(0, state.counts[key] - 1),
        total: Math.max(0, state.counts.total - 1),
      },
    })),
}));

interface CartState {
  items: Array<{
    productId: string;
    product: Product;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  customerName: string;
  customerPhone: string;
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setCustomerInfo: (name: string, phone: string) => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customerName: '',
  customerPhone: '',
  addItem: (product, quantity) => {
    const existingItem = get().items.find((item) => item.productId === product.id);
    if (existingItem) {
      set((state) => ({
        items: state.items.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: (item.quantity + quantity) * item.unitPrice,
              }
            : item
        ),
      }));
    } else {
      set((state) => ({
        items: [
          ...state.items,
          {
            productId: product.id,
            product,
            quantity,
            unitPrice: product.price,
            total: quantity * product.price,
          },
        ],
      }));
    }
  },
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId),
    })),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity, total: quantity * item.unitPrice }
          : item
      ),
    })),
  clearCart: () => set({ items: [], customerName: '', customerPhone: '' }),
  setCustomerInfo: (name, phone) => set({ customerName: name, customerPhone: phone }),
  getTotal: () => get().items.reduce((sum, item) => sum + item.total, 0),
}));

interface AppState {
  branches: Branch[];
  products: Product[];
  setBranches: (branches: Branch[]) => void;
  setProducts: (products: Product[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  branches: [],
  products: [],
  setBranches: (branches) => set({ branches }),
  setProducts: (products) => set({ products }),
}));
