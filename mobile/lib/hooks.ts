import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { api } from './api';

// Hook that invalidates a query key every time the screen comes into focus.
// Use alongside useQuery so the data refreshes on every navigation to the screen.
export function useRefreshOnFocus(queryKey: unknown[]) {
  const qc = useQueryClient();
  useFocusEffect(useCallback(() => {
    qc.invalidateQueries({ queryKey });
  }, [qc, JSON.stringify(queryKey)]));
}

export const useDashboard = () => {
  useRefreshOnFocus(['dashboard']);
  return useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard.summary, refetchInterval: 60_000 });
};

export const useOrders = (params?: any) => {
  useRefreshOnFocus(['orders', params]);
  return useQuery({ queryKey: ['orders', params], queryFn: () => api.orders.list(params) });
};

export const useOrder = (id: string) =>
  useQuery({ queryKey: ['order', id], queryFn: () => api.orders.getById(id), enabled: !!id });

export const useInventory = (params?: any) => {
  useRefreshOnFocus(['inventory', params]);
  return useQuery({ queryKey: ['inventory', params], queryFn: () => api.inventory.list(params) });
};

export const useEmployees = (params?: any) => {
  useRefreshOnFocus(['employees', params]);
  return useQuery({ queryKey: ['employees', params], queryFn: () => api.employees.list(params) });
};

export const useLeave = (params?: any) => {
  useRefreshOnFocus(['leave', params]);
  return useQuery({ queryKey: ['leave', params], queryFn: () => api.employees.listLeave(params) });
};

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
