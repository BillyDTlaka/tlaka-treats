import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function AmbassadorLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="reports" />
      </Stack>
    </SafeAreaProvider>
  )
}
