import { create } from 'zustand'

export interface CartItem {
  productId: string
  variantId: string
  quantity: number
  productName: string
  variantName: string
  price: number
}

interface CartState {
  items: CartItem[]
  ambassadorCode: string
  notes: string
  addItem: (item: CartItem) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  setAmbassadorCode: (code: string) => void
  setNotes: (notes: string) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  ambassadorCode: '',
  notes: '',

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.variantId === item.variantId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          ),
        }
      }
      return { items: [...state.items, item] }
    }),

  removeItem: (variantId) =>
    set((state) => ({
      items: state.items.filter((i) => i.variantId !== variantId),
    })),

  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.variantId !== variantId)
          : state.items.map((i) =>
              i.variantId === variantId ? { ...i, quantity } : i
            ),
    })),

  setAmbassadorCode: (code) => set({ ambassadorCode: code }),
  setNotes: (notes) => set({ notes }),
  clearCart: () => set({ items: [], ambassadorCode: '', notes: '' }),

  getTotal: () =>
    get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

  getItemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),
}))
