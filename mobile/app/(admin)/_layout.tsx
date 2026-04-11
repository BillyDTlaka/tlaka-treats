import { Stack } from 'expo-router'

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="overview" />
      <Stack.Screen name="ambassadors" />
    </Stack>
  )
}
