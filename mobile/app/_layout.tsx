import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { useAuthStore, isAdmin, isAmbassador } from '../store/auth.store'

export default function RootLayout() {
  const { isLoading, user } = useAuthStore()

  // This effect runs whenever auth state changes (login, logout, token expiry).
  // Because _layout.tsx is ALWAYS mounted, it will catch logout from any screen.
  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.replace('/(auth)/login')
    } else if (isAdmin(user)) {
      router.replace('/(admin)/overview')
    } else if (isAmbassador(user)) {
      router.replace('/(ambassador)/dashboard')
    } else {
      router.replace('/(customer)/home')
    }
  }, [isLoading, user])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(ambassador)" />
      <Stack.Screen name="(admin)" />
    </Stack>
  )
}
