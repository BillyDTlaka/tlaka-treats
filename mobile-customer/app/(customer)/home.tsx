import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsApi, ambassadorsApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../store/cart.store'
import CustomerTabBar from '../../components/CustomerTabBar'

export default function CustomerHome() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const cartCount = useCartStore((s) => s.getItemCount())

  const [products, setProducts] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [ambassadorApp, setAmbassadorApp] = useState<any>(undefined) // undefined=loading, null=none

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productsApi.getAll()
      setProducts(data)
      setFiltered(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchAmbassadorStatus = useCallback(async () => {
    const data = await ambassadorsApi.myApplication()
    setAmbassadorApp(data) // null if no application
  }, [])

  useEffect(() => { fetchProducts(); fetchAmbassadorStatus() }, [fetchProducts, fetchAmbassadorStatus])

  useEffect(() => {
    let result = products
    if (selectedCategory) {
      result = result.filter((p: any) => p.category?.name === selectedCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((p: any) => p.name?.toLowerCase().includes(q))
    }
    setFiltered(result)
  }, [search, selectedCategory, products])

  const categories = Array.from(
    new Set(products.map((p: any) => p.category?.name).filter(Boolean))
  ) as string[]

  const onRefresh = () => {
    setRefreshing(true)
    fetchProducts()
    fetchAmbassadorStatus()
  }

  const getFromPrice = (product: any) => {
    const prices = product.variants?.flatMap((v: any) =>
      v.prices?.filter((p: any) => p.tier === 'RETAIL') ?? []
    ) ?? []
    if (prices.length === 0) return null
    const min = Math.min(...prices.map((p: any) => Number(p.price)))
    return min
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hey, {user?.firstName} 👋</Text>
            <Text style={styles.subGreeting}>What are you craving today?</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(customer)/checkout')}
            style={styles.cartHeaderBtn}
          >
            <Text style={styles.cartHeaderIcon}>🛍️</Text>
            {cartCount > 0 && (
              <View style={styles.cartHeaderBadge}>
                <Text style={styles.cartHeaderBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search treats..."
            placeholderTextColor="#c0a0a0"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      {categories.length > 0 && (
        <View style={styles.categoryRow}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#8B3A3A" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B3A3A" />}
          ListHeaderComponent={
            ambassadorApp === null ? (
              // No application — show invite banner
              <TouchableOpacity style={styles.ambassadorBanner} onPress={() => router.push('/(customer)/ambassador-apply' as any)} activeOpacity={0.85}>
                <View style={styles.ambassadorBannerLeft}>
                  <Text style={styles.ambassadorBannerEmoji}>🌟</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ambassadorBannerTitle}>Become an Ambassador</Text>
                    <Text style={styles.ambassadorBannerSub}>Earn commission on every order with your unique code</Text>
                  </View>
                </View>
                <Text style={styles.ambassadorBannerArrow}>→</Text>
              </TouchableOpacity>
            ) : ambassadorApp && ambassadorApp.status !== 'ACTIVE' ? (
              // Has application — show status pill
              <TouchableOpacity style={styles.ambassadorStatusBanner} onPress={() => router.push('/(customer)/ambassador-status' as any)} activeOpacity={0.85}>
                <Text style={styles.ambassadorStatusEmoji}>
                  {ambassadorApp.status === 'PENDING' ? '⏳' : '⚠️'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ambassadorStatusTitle}>Ambassador Application</Text>
                  <Text style={styles.ambassadorStatusSub}>
                    {ambassadorApp.status === 'PENDING' ? 'Under review — tap to check status' : 'Account suspended — tap for details'}
                  </Text>
                </View>
                <Text style={styles.ambassadorBannerArrow}>→</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No treats found</Text>
            </View>
          }
          renderItem={({ item }: any) => {
            const fromPrice = getFromPrice(item)
            return (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => router.push(`/(customer)/product/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.productImageArea}>
                  <Text style={styles.productEmoji}>🍪</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  {item.category?.name && (
                    <Text style={styles.productCategory}>{item.category.name}</Text>
                  )}
                  {fromPrice != null ? (
                    <Text style={styles.productPrice}>From R{fromPrice.toFixed(2)}</Text>
                  ) : (
                    <Text style={styles.productPriceNA}>Price on request</Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      <CustomerTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  header: { backgroundColor: '#8B3A3A', paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontSize: 20, fontWeight: '800', color: '#fff' },
  subGreeting: { fontSize: 13, color: '#f5d0d0', marginTop: 2 },
  cartHeaderBtn: { position: 'relative', padding: 6 },
  cartHeaderIcon: { fontSize: 26 },
  cartHeaderBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  cartHeaderBadgeText: { color: '#8B3A3A', fontSize: 9, fontWeight: '800' },
  searchContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#fff', paddingVertical: 10 },
  clearSearch: { fontSize: 14, color: 'rgba(255,255,255,0.7)', padding: 4 },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5eded',
  },
  categoryChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FDF6F0',
    borderWidth: 1,
    borderColor: '#e8d5d5',
  },
  categoryChipActive: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#8B3A3A' },
  categoryChipTextActive: { color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 100 },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  productImageArea: {
    backgroundColor: '#FFF0E6',
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: { fontSize: 48 },
  productInfo: { padding: 12 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  productCategory: { fontSize: 11, color: '#bbb', marginBottom: 6 },
  productPrice: { fontSize: 14, fontWeight: '700', color: '#8B3A3A' },
  productPriceNA: { fontSize: 12, color: '#bbb', fontStyle: 'italic' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#999' },
  ambassadorBanner: {
    backgroundColor: '#8B3A3A', borderRadius: 16, padding: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ambassadorBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  ambassadorBannerEmoji: { fontSize: 28 },
  ambassadorBannerTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  ambassadorBannerSub: { fontSize: 11, color: '#f5d0d0', marginTop: 2 },
  ambassadorBannerArrow: { fontSize: 18, color: '#fff', fontWeight: '700' },
  ambassadorStatusBanner: {
    backgroundColor: '#FFF3CD', borderRadius: 16, padding: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#ffeeba',
  },
  ambassadorStatusEmoji: { fontSize: 24, marginRight: 12 },
  ambassadorStatusTitle: { fontSize: 14, fontWeight: '800', color: '#856404' },
  ambassadorStatusSub: { fontSize: 11, color: '#856404', marginTop: 2 },
})
