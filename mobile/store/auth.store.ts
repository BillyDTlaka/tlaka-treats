import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
}

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
  loadFromStorage: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('token', token)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    set({ token, user })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token')
    await SecureStore.deleteItemAsync('user')
    set({ token: null, user: null })
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('token')
      const userStr = await SecureStore.getItemAsync('user')
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr) })
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))

export const hasRole = (user: User | null, role: string) =>
  user?.roles?.includes(role) ?? false

export const isAdmin = (user: User | null) => hasRole(user, 'ADMIN')
export const isAmbassador = (user: User | null) => hasRole(user, 'AMBASSADOR')
