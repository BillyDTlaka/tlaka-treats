import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('tt_customer_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('tt_customer_token')
      await SecureStore.deleteItemAsync('tt_customer_user')
      const { useAuthStore } = await import('../store/auth.store')
      useAuthStore.setState({ token: null, user: null })
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data),
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    api.post('/auth/register', data).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}

export const productsApi = {
  getAll: (tier?: string) =>
    api.get('/products', { params: { tier } }).then(r => r.data),
  getById: (id: string) =>
    api.get(`/products/${id}`).then(r => r.data),
}

export const ordersApi = {
  create: (data: any) => api.post('/orders', data).then(r => r.data),
  createForCustomer: (data: {
    firstName: string
    lastName: string
    phone: string
    address?: string
    items: Array<{ variantId: string; quantity: number }>
    notes?: string
    paymentMethod?: 'CASH' | 'EFT' | 'CARD'
  }) => api.post('/orders/for-customer', data).then(r => r.data),
  getMy: () => api.get('/orders/my').then(r => r.data),
  getAmbassador: () => api.get('/orders/ambassador').then(r => r.data),
  getAmbassadorCustomers: () => api.get('/orders/ambassador/customers').then(r => r.data),
}

export const paymentsApi = {
  getEftDetails: () => api.get('/payments/eft-details').then(r => r.data),
  initiatePayFast: (orderId: string) =>
    api.post('/payments/payfast/initiate', { orderId }).then(r => r.data),
}

export const ambassadorsApi = {
  apply: (bio?: string) => api.post('/ambassadors/apply', { bio }).then(r => r.data),
  me: () => api.get('/ambassadors/me').then(r => r.data),
  getActive: () => api.get('/ambassadors/active').then(r => r.data),
  earnings: () => api.get('/ambassadors/me/earnings').then(r => r.data),
  requestPayout: (method?: string, notes?: string) =>
    api.post('/ambassadors/me/payout-request', { method, notes }).then(r => r.data),
}

export default api
