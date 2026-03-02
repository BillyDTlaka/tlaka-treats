import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../store/auth.store'

export default function Index() {
  const { loadFromStorage } = useAuthStore()

  useEffect(() => {
    loadFromStorage()
  }, [])

  // _layout.tsx watches auth state and will redirect once loadFromStorage completes
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#8B3A3A' }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  )
}
