import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';

// Tell React Query to refetch when the app comes back to the foreground
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,          // always consider data stale — refetch on every mount
      gcTime: 5 * 60 * 1000, // keep unused cache for 5 min so nav back is instant
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  },
});

function getHomeRoute(user: any): string {
  const roles: string[] = user?.roles ?? [];
  if (roles.includes('ADMIN'))      return '/(tabs)';
  if (roles.includes('AMBASSADOR')) return '/(ambassador)/dashboard';
  return '/(customer)/home';
}

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const router  = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth       = segments[0] === '(auth)';
    const inAdmin      = segments[0] === '(tabs)';
    const roles: string[] = user?.roles ?? [];
    const isAdmin      = roles.includes('ADMIN');

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }
    if (user && inAuth) {
      router.replace(getHomeRoute(user) as any);
      return;
    }
    // Non-admin tried to access admin area — send them home
    if (user && inAdmin && !isAdmin) {
      router.replace(getHomeRoute(user) as any);
    }
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(ambassador)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}
