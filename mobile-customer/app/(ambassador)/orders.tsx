import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ordersApi } from '../../services/api'
import AmbassadorTabBar from '../../components/AmbassadorTabBar'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: 'Pending' },
  CONFIRMED: { bg: '#D1ECF1', text: '#0C5460', label: 'Confirmed' },
  BAKING:    { bg: '#FFE0B2', text: '#E65100', label: '🔥 Baking' },
  READY:     { bg: '#D4EDDA', text: '#155724', label: '✅ Ready' },
  DELIVERED: { bg: '#E2D9F3', text: '#432874', label: '🚚 Delivered' },
  CANCELLED: { bg: '#F8D7DA', text: '#721C24', label: 'Cancelled' },
}

type FilterType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'DELIVERED'
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'DELIVERED', label: 'Delivered' },
]

export default function AmbassadorOrdersScreen() {
  const insets = useSafeAreaInsets()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('ALL')

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersApi.getAmbassador()
      setOrders(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const onRefresh = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const filtered = filter === 'ALL'
    ? orders
    : orders.filter((o) => o.status === filter)

  const totalCommission = orders.reduce(
    (sum, o) => sum + (o.commission?.amount ? Number(o.commission.amount) : 0),
    0
  )

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#8B3A3A" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <Text style={styles.headerTitle}>Attributed Orders</Text>
        <Text style={styles.headerSub}>
          {orders.length} order{orders.length !== 1 ? 's' : ''} · R{totalCommission.toFixed(2)} earned
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B3A3A" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>Share your referral code to start earning</Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const statusInfo = STATUS_COLORS[order.status] ?? { bg: '#eee', text: '#666', label: order.status }
          const hasCommission = !!order.commission

          return (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.customerInfo}>
                  <View style={styles.customerAvatar}>
                    <Text style={styles.customerAvatarText}>
                      {order.customer?.firstName?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.customerName}>
                      {order.customer?.firstName} {order.customer?.lastName}
                    </Text>
                    <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                  <Text style={[styles.statusText, { color: statusInfo.text }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>

              <View style={styles.orderBody}>
                <View style={styles.orderStat}>
                  <Text style={styles.orderStatLabel}>Order Total</Text>
                  <Text style={styles.orderStatValue}>R{Number(order.total).toFixed(2)}</Text>
                </View>
                <View style={styles.orderStatDivider} />
                <View style={styles.orderStat}>
                  <Text style={styles.orderStatLabel}>Commission</Text>
                  {hasCommission ? (
                    <View>
                      <Text style={styles.commissionAmount}>
                        +R{Number(order.commission.amount).toFixed(2)}
                      </Text>
                      <View style={[
                        styles.commissionStatus,
                        { backgroundColor: order.commission.status === 'PAID' ? '#D4EDDA' : '#FFF3CD' }
                      ]}>
                        <Text style={[
                          styles.commissionStatusText,
                          { color: order.commission.status === 'PAID' ? '#155724' : '#856404' }
                        ]}>
                          {order.commission.status === 'PAID' ? 'Paid' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.commissionNA}>—</Text>
                  )}
                </View>
                <View style={styles.orderStatDivider} />
                <View style={styles.orderStat}>
                  <Text style={styles.orderStatLabel}>Items</Text>
                  <Text style={styles.orderStatValue}>{order.items?.length ?? 0}</Text>
                </View>
              </View>
            </View>
          )
        }}
      />

      <AmbassadorTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6F0' },
  header: {
    backgroundColor: '#8B3A3A',
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#f5d0d0', marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5eded',
  },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FDF6F0',
    borderWidth: 1,
    borderColor: '#e8d5d5',
  },
  filterChipActive: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#8B3A3A' },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingBottom: 100 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5eded',
  },
  customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: { fontSize: 15, fontWeight: '700', color: '#8B3A3A' },
  customerName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  orderDate: { fontSize: 12, color: '#999', marginTop: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderBody: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
  },
  orderStat: { flex: 1, alignItems: 'center' },
  orderStatLabel: { fontSize: 11, color: '#999', marginBottom: 4, textAlign: 'center' },
  orderStatValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  orderStatDivider: { width: 1, backgroundColor: '#f5eded' },
  commissionAmount: { fontSize: 16, fontWeight: '700', color: '#2E7D32', textAlign: 'center' },
  commissionStatus: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'center',
  },
  commissionStatusText: { fontSize: 10, fontWeight: '700' },
  commissionNA: { fontSize: 16, color: '#ccc', textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center' },
})
