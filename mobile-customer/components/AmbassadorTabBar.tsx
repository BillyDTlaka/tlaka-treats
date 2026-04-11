import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '../store/cart.store'

const TABS = [
  { label: 'Dashboard', icon: '📊', path: '/(ambassador)/dashboard' },
  { label: 'Orders',    icon: '📦', path: '/(ambassador)/orders'    },
  { label: 'Shop',      icon: '🍪', path: '/(ambassador)/shop'      },
  { label: 'Cart',      icon: '🛍️', path: '/(ambassador)/checkout'  },
  { label: 'Profile',   icon: '👤', path: '/(ambassador)/profile'   },
]

export default function AmbassadorTabBar() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const cartCount = useCartStore((s) => s.getItemCount())

  const isActive = (path: string) => {
    if (path === '/(ambassador)/dashboard') return pathname.includes('/dashboard')
    if (path === '/(ambassador)/orders')    return pathname.includes('/orders')
    if (path === '/(ambassador)/shop')      return pathname.includes('/shop')
    if (path === '/(ambassador)/checkout')  return pathname.includes('/checkout')
    if (path === '/(ambassador)/profile')   return pathname.includes('/profile')
    return false
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      {TABS.map((tab) => {
        const active = isActive(tab.path)
        const isCart = tab.path === '/(ambassador)/checkout'
        return (
          <TouchableOpacity
            key={tab.path}
            style={styles.tab}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Text style={styles.icon}>{tab.icon}</Text>
              {isCart && cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
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
    borderTopColor: '#e8d5d5',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrapper: { position: 'relative' },
  icon: { fontSize: 22 },
  cartBadge: {
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
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
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
