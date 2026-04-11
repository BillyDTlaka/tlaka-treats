import axios from 'axios';
import { getToken } from './auth';

// Update this to your Railway API URL
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tlaka-treats-production.up.railway.app';

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const get  = (url: string, params?: any) => client.get(url, { params }).then(r => r.data);
const post = (url: string, data?: any)   => client.post(url, data).then(r => r.data);
const patch = (url: string, data?: any)  => client.patch(url, data).then(r => r.data);
const del  = (url: string)               => client.delete(url).then(r => r.data);

export const api = {
  auth: {
    login:   (email: string, password: string) => post('/auth/login', { email, password }),
    me:      ()                                => get('/auth/me'),
  },
  dashboard: {
    summary: () => get('/dashboard/summary'),
  },
  orders: {
    list:      (params?: any) => get('/orders', params),
    getById:   (id: string)   => get(`/orders/${id}`),
    updateStatus: (id: string, status: string) => patch(`/orders/${id}/status`, { status }),
  },
  inventory: {
    list:      (params?: any) => get('/inventory', params),
    adjust:    (id: string, d: any) => patch(`/inventory/${id}`, d),
  },
  employees: {
    list:      (params?: any)      => get('/employees', params),
    getSchedule: (params?: any)    => get('/employees/schedule', params),
    listLeave: (params?: any)      => get('/employees/leave', params),
    approveLeave: (id: string)     => patch(`/employees/leave/${id}/approve`, {}),
    rejectLeave:  (id: string)     => patch(`/employees/leave/${id}/reject`, {}),
  },
  chat: {
    listConversations: ()          => get('/chat/conversations'),
    createConversation: ()         => post('/chat/conversations'),
    getConversation: (id: string)  => get(`/chat/conversations/${id}`),
  },
  ambassadors: {
    list:         ()                                              => get('/ambassadors'),
    updateStatus: (id: string, status: string, note?: string)    => patch(`/ambassadors/${id}/status`, { status, note }),
    reviewKyc:    (id: string, kycStatus: string, kycNote?: string) => patch(`/ambassadors/${id}/kyc/review`, { kycStatus, kycNote }),
    update:       (id: string, data: any)                        => patch(`/ambassadors/${id}`, data),
  },
};

export { BASE_URL };
