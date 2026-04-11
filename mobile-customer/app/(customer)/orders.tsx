import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ordersApi } from '../../services/api'
import CustomerTabBar from '../../components/CustomerTabBar'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: 'Pending' },
  CONFIRMED: { bg: '#D1ECF1', text: '#0C5460', label: 'Confirmed' },
  BAKING:    { bg: '#FFE0B2', text: '#E65100', label: '🔥 Baking' },
  READY:     { bg: '#D4EDDA', text: '#155724', label: '✅ Ready' },
  DELIVERED: { bg: '#E2D9F3', text: '#432874', label: '🚚 Delivered' },
  CANCELLED: { bg: '#F8D7DA', text: '#721C24', label: 'Cancelled' },
}

export default function CustomerOrdersScreen() {
  const insets = useSafeAreaInsets()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersApi.getMy()
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
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
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B3A3A" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>When you place an order, it will appear here</Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const statusInfo = STATUS_COLORS[order.status] ?? { bg: '#eee', text: '#666', label: order.status }
          const itemCount = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0
          return (
            <View style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderId}>
                    Order #{order.id.slice(-8).toUpperCase()}
                  </Text>
                  <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                  <Text style={[styles.statusText, { color: statusInfo.text }]}>
                    {statusInfo.label}
                  </Text>
                </View>
              </View>

              {/* Items */}
              {order.items?.slice(0, 3).map((item: any) => (
                <View key={item.id} style={styles.orderItemRow}>
                  <Text style={styles.orderItemDot}>•</Text>
                  <Text style={styles.orderItemName}>
                    {item.variant?.product?.name ?? 'Item'} × {item.quantity}
                  </Text>
                  <Text style={styles.orderItemSubtotal}>
                    R{Number(item.subtotal ?? item.unitPrice * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              {order.items?.length > 3 && (
                <Text style={styles.moreItems}>+{order.items.length - 3} more item(s)</Text>
              )}

              <View style={styles.orderCardFooter}>
                <Text style={styles.itemCount}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                <Text style={styles.orderTotal}>R{Number(order.total).toFixed(2)}</Text>
              </View>
            </View>
          )
        }}
      />

      <CustomerTabBar />
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
  listContent: { padding: 16, paddingBottom: 100 },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  orderDate: { fontSize: 12, color: '#999', marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  orderItemDot: { color: '#ccc', marginRight: 6 },
  orderItemName: { flex: 1, fontSize: 13, color: '#555' },
  orderItemSubtotal: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  moreItems: { fontSize: 12, color: '#999', marginBottom: 4, marginLeft: 14 },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5eded',
  },
  itemCount: { fontSize: 13, color: '#999' },
  orderTotal: { fontSize: 18, fontWeight: '800', color: '#8B3A3A' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center' },
})
