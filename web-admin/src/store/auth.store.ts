import { create } from 'zustand'
import { getToken, getUser, saveAuth, clearAuth } from '../lib/auth'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  roles: string[]
  permissions: string[]
}

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  setAuth: (token: string, user: User) => void
  logout: () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setAuth: (token, user) => {
    saveAuth(token, user)
    set({ token, user })
  },

  logout: () => {
    clearAuth()
    set({ token: null, user: null })
  },

  loadFromStorage: () => {
    const token = getToken()
    const user = getUser()
    set({ token, user: user ?? null, isLoading: false })
  },
}))

export const isAdmin = (user: User | null) => user?.roles?.includes('ADMIN') ?? false
export const isAmbassador = (user: User | null) => user?.roles?.includes('AMBASSADOR') ?? false
