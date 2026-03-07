import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

/**
 * In development (Expo Go on a physical device), the bundle is served from
 * your dev machine. We need to point API calls at that same machine's IP.
 *
 * Constants.expoGoConfig?.debuggerHost  →  "192.168.1.42:8081"  (SDK 44+)
 * We strip the port and use port 3000 for the API.
 *
 * On iOS simulator, localhost works fine so we skip the override.
 * In production, falls back to the apiUrl in app.json extra.
 */
const getBaseUrl = (): string => {
  if (__DEV__) {
    // Primary: Expo Go runtime config (physical device via Expo Go)
    const debuggerHost = (Constants as any).expoGoConfig?.debuggerHost
      ?? (Constants as any).manifest2?.extra?.expoClient?.hostUri
      ?? ''
    if (debuggerHost) {
      const host = String(debuggerHost).split(':')[0]
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:3000`
      }
    }
  }
  return Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:3000'
}

const BASE_URL = getBaseUrl()

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global 401 handler — auto-logout when token is rejected by the server
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('token')
      await SecureStore.deleteItemAsync('user')
      // Importing router directly into a service file causes issues in some
      // Expo Router versions, so we update the store directly and let
      // _layout.tsx's useEffect handle the redirect.
      const { useAuthStore } = await import('../store/auth.store')
      useAuthStore.setState({ token: null, user: null })
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    api.post('/auth/register', data).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}

// Products
export const productsApi = {
  getAll: (tier?: string) =>
    api.get('/products', { params: { tier } }).then(r => r.data),
  getById: (id: string) =>
    api.get(`/products/${id}`).then(r => r.data),
  getAllAdmin: () => api.get('/products/admin').then(r => r.data),
}

// Orders
export const ordersApi = {
  create: (data: any) => api.post('/orders', data).then(r => r.data),
  createAdmin: (data: any) => api.post('/orders/admin', data).then(r => r.data),
  getMy: () => api.get('/orders/my').then(r => r.data),
  getAmbassador: () => api.get('/orders/ambassador').then(r => r.data),
  getAll: () => api.get('/orders').then(r => r.data),
  updateStatus: (id: string, status: string, note?: string) =>
    api.patch(`/orders/${id}/status`, { status, note }).then(r => r.data),
}

// Ambassadors
export const ambassadorsApi = {
  apply: (bio?: string) => api.post('/ambassadors/apply', { bio }).then(r => r.data),
  me: () => api.get('/ambassadors/me').then(r => r.data),
  getAll: () => api.get('/ambassadors').then(r => r.data),
  getActive: () => api.get('/ambassadors/active').then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/ambassadors/${id}/status`, { status }).then(r => r.data),
}

// Customers (admin)
export const customersApi = {
  getAll: () => api.get('/customers').then(r => r.data),
}

export default api
