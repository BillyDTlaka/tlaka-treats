import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function getHomeRoute(user: any): string {
  const roles: string[] = user?.roles ?? [];
  if (roles.includes('AMBASSADOR')) return '/(ambassador)/dashboard';
  return '/(customer)/home';
}

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }
    if (user && inAuth) {
      router.replace(getHomeRoute(user) as any);
    }
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
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
