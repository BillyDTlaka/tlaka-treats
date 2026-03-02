import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TABS = [
  { label: 'Dashboard', icon: '📊', path: '/(ambassador)/dashboard' },
  { label: 'Orders', icon: '📦', path: '/(ambassador)/orders' },
  { label: 'Profile', icon: '👤', path: '/(ambassador)/profile' },
]

export default function AmbassadorTabBar() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/(ambassador)/dashboard') return pathname.includes('/dashboard')
    if (path === '/(ambassador)/orders') return pathname.includes('/orders')
    if (path === '/(ambassador)/profile') return pathname.includes('/profile')
    return false
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map((tab) => {
        const active = isActive(tab.path)
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
            {active && <View style={styles.activeDot} />}
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8d5d5',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  icon: { fontSize: 22 },
  label: { fontSize: 11, color: '#999', fontWeight: '500' },
  activeLabel: { color: '#8B3A3A', fontWeight: '700' },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8B3A3A',
    marginTop: 2,
  },
})
