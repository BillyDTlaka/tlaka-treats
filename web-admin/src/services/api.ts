import axios from 'axios'
import { getToken, clearAuth } from '../lib/auth'

export const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? 'https://tlaka-treats-production.up.railway.app'

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 })

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  r => r,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth()
      import('../store/auth.store').then(({ useAuthStore }) => {
        useAuthStore.setState({ token: null, user: null })
      })
    }
    return Promise.reject(error)
  }
)

const get   = (url: string, params?: any) => client.get(url, { params }).then(r => r.data)
const post  = (url: string, data?: any)  => client.post(url, data).then(r => r.data)
const patch = (url: string, data?: any)  => client.patch(url, data).then(r => r.data)

export const api = {
  auth: {
    login:    (email: string, password: string) => post('/auth/login', { email, password }),
    register: (data: any) => post('/auth/register', data),
    me:       () => get('/auth/me'),
  },
  dashboard: {
    summary: () => get('/dashboard/summary'),
  },
  orders: {
    list:         (params?: any) => get('/orders', params),
    getById:      (id: string)   => get(`/orders/${id}`),
    updateStatus: (id: string, status: string) => patch(`/orders/${id}/status`, { status }),
  },
  inventory: {
    list:   (params?: any)      => get('/inventory', params),
    adjust: (id: string, d: any) => patch(`/inventory/${id}`, d),
  },
  employees: {
    list:         (params?: any) => get('/employees', params),
    listLeave:    (params?: any) => get('/employees/leave', params),
    approveLeave: (id: string)   => patch(`/employees/leave/${id}/approve`, {}),
    rejectLeave:  (id: string)   => patch(`/employees/leave/${id}/reject`, {}),
  },
  chat: {
    createConversation: ()        => post('/chat/conversations'),
    getConversation:    (id: string) => get(`/chat/conversations/${id}`),
  },
  productsAdmin: {
    list:               ()                          => get('/products/admin'),
    create:             (data: any)                 => post('/products', data),
    update:             (id: string, data: any)     => patch(`/products/${id}`, data),
    addVariant:         (id: string, data: any)     => post(`/products/${id}/variants`, data),
    removeVariant:      (id: string, vid: string)   => client.delete(`/products/${id}/variants/${vid}`).then(r => r.data),
    updateVariantPrice: (id: string, vid: string, data: any) => patch(`/products/${id}/variants/${vid}/prices`, data),
    listCategories:     ()                          => get('/products/categories'),
    createCategory:     (name: string, desc?: string) => post('/products/categories', { name, description: desc }),
  },
  ambassadors: {
    list:         ()                                            => get('/ambassadors'),
    updateStatus: (id: string, status: string, note?: string)  => patch(`/ambassadors/${id}/status`, { status, note }),
    reviewKyc:    (id: string, kycStatus: string, kycNote?: string) => patch(`/ambassadors/${id}/kyc/review`, { kycStatus, kycNote }),
  },
  // customer/ambassador endpoints (same as web-customer)
  products: {
    getAll: (tier?: string) => get('/products', { tier }),
    getById: (id: string)   => get(`/products/${id}`),
  },
  customerOrders: {
    create:       (data: any) => post('/orders', data),
    getMy:        () => get('/orders/my'),
    getAmbassador: () => get('/orders/ambassador'),
  },
  ambassadorProfile: {
    apply:          (data: any) => post('/ambassadors/apply', data),
    myApplication:  () => get('/ambassadors/me').catch(() => null),
    me:             () => get('/ambassadors/me'),
    getActive:      () => get('/ambassadors/active'),
    earnings:       () => get('/ambassadors/me/earnings'),
    requestPayout:  (method?: string, notes?: string) => post('/ambassadors/me/payout-request', { method, notes }),
  },
}

export default client

// Named aliases matching web-customer's import names, so shared page files work as-is
export const productsApi = {
  getAll:  (tier?: string) => api.products.getAll(tier),
  getById: (id: string)    => api.products.getById(id),
}

export const ordersApi = {
  create:         (data: any) => api.customerOrders.create(data),
  getMy:          ()          => api.customerOrders.getMy(),
  getAmbassador:  ()          => api.customerOrders.getAmbassador(),
}

export const ambassadorsApi = {
  apply:          (data: any)            => api.ambassadorProfile.apply(data),
  myApplication:  ()                     => api.ambassadorProfile.myApplication(),
  me:             ()                     => api.ambassadorProfile.me(),
  getActive:      ()                     => api.ambassadorProfile.getActive(),
  earnings:       ()                     => api.ambassadorProfile.earnings(),
  requestPayout:  (m?: string, n?: string) => api.ambassadorProfile.requestPayout(m, n),
}
