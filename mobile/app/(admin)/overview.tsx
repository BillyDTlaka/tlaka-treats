import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { ordersApi, ambassadorsApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  BAKING: '#8B5CF6',
  READY: '#10B981',
  DELIVERED: '#6B7280',
  CANCELLED: '#EF4444',
}

export default function AdminOverview() {
  const { user, logout } = useAuthStore()
  const [orders, setOrders] = useState<any[]>([])
  const [ambassadors, setAmbassadors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    Promise.all([ordersApi.getAll(), ambassadorsApi.getAll()])
      .then(([ords, ambs]) => { setOrders(ords); setAmbassadors(ambs) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
  const pendingOrders = orders.filter(o => o.status === 'PENDING').length
  const activeAmbassadors = ambassadors.filter(a => a.status === 'ACTIVE').length

  const updateOrderStatus = async (id: string, status: string) => {
    await ordersApi.updateStatus(id, status)
    load()
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#8B3A3A" />

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Admin 🛠️</Text>
        <Text style={styles.subtitle}>Tlaka Treats Operations</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>R{revenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{orders.length}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingOrders}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeAmbassadors}</Text>
          <Text style={styles.statLabel}>Ambassadors</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Orders</Text>
      {orders.slice(0, 10).map((order) => (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderRow}>
            <Text style={styles.customerName}>{order.customer?.firstName} {order.customer?.lastName}</Text>
            <Text style={styles.orderAmount}>R{Number(order.total).toFixed(2)}</Text>
          </View>
          {order.ambassador && (
            <Text style={styles.ambassador}>via {order.ambassador.code}</Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] || '#999' }]}>
            <Text style={styles.statusText}>{order.status}</Text>
          </View>
          {order.status === 'PENDING' && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => updateOrderStatus(order.id, 'CONFIRMED')}
            >
              <Text style={styles.confirmBtnText}>✓ Confirm Order</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  header: { backgroundColor: '#1a1a1a', padding: 24, paddingTop: 60 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: '#999', marginTop: 2 },
  logoutBtn: { position: 'absolute', top: 60, right: 24, backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 8, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 16, marginBottom: 10 },
  orderCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  customerName: { fontWeight: '600', color: '#1a1a1a', fontSize: 15 },
  orderAmount: { fontWeight: '700', color: '#1a1a1a', fontSize: 15 },
  ambassador: { fontSize: 12, color: '#8B3A3A', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  confirmBtn: { marginTop: 10, backgroundColor: '#8B3A3A', borderRadius: 8, padding: 10, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
