import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '../store/cart.store'

const TABS = [
  { label: 'Shop',    icon: '🛍️', path: '/(customer)/home'    },
  { label: 'Orders',  icon: '📦', path: '/(customer)/orders'  },
  { label: 'Profile', icon: '👤', path: '/(customer)/profile' },
]

export default function CustomerTabBar() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const cartCount = useCartStore((s) => s.getItemCount())

  const isActive = (path: string) => {
    if (path === '/(customer)/home')    return pathname === '/home' || pathname.includes('/home')
    if (path === '/(customer)/orders')  return pathname.includes('/orders')
    if (path === '/(customer)/profile') return pathname.includes('/profile')
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
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>{tab.icon}</Text>
              {tab.label === 'Shop' && cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </View>
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
    borderTopColor: '#f0e0e0',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrapper: { position: 'relative' },
  icon: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#8B3A3A',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
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
