import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard.summary, refetchInterval: 60000 });

export const useOrders = (params?: any) =>
  useQuery({ queryKey: ['orders', params], queryFn: () => api.orders.list(params) });

export const useOrder = (id: string) =>
  useQuery({ queryKey: ['order', id], queryFn: () => api.orders.getById(id), enabled: !!id });

export const useInventory = (params?: any) =>
  useQuery({ queryKey: ['inventory', params], queryFn: () => api.inventory.list(params) });

export const useEmployees = (params?: any) =>
  useQuery({ queryKey: ['employees', params], queryFn: () => api.employees.list(params) });

export const useLeave = (params?: any) =>
  useQuery({ queryKey: ['leave', params], queryFn: () => api.employees.listLeave(params) });

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.orders.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
};

export const useApproveLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.employees.approveLeave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave'] }),
  });
};

export const useRejectLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.employees.rejectLeave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave'] }),
  });
};
