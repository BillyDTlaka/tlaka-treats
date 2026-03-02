import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ambassadorsApi, ordersApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import AmbassadorTabBar from '../../components/AmbassadorTabBar'

export default function AmbassadorDashboard() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [ambassador, setAmbassador] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [amb, ords] = await Promise.all([ambassadorsApi.me(), ordersApi.getAmbassador()])
      setAmbassador(amb)
      setOrders(ords)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const shareCode = async () => {
    if (!ambassador?.code) return
    try {
      await Share.share({
        message: `Order from Tlaka Treats using my code: ${ambassador.code}\nFresh biscuits and scones delivered to your door! 🍪`,
      })
    } catch {
      // user dismissed
    }
  }

  const totalEarnings = orders.reduce(
    (sum: number, o: any) => sum + (o.commission?.amount ? Number(o.commission.amount) : 0),
    0
  )
  const pendingCommissions = orders.filter((o: any) => o.commission?.status === 'PENDING').length
  const paidCommissions = orders.filter((o: any) => o.commission?.status === 'PAID').length
  const recentOrders = orders.slice(0, 5)

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B3A3A" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
          <View>
            <Text style={styles.greeting}>Hey, {user?.firstName} 👋</Text>
            <Text style={styles.subtitle}>Ambassador Dashboard</Text>
          </View>
          {ambassador?.status && (
            <View style={[
              styles.statusPill,
              { backgroundColor: ambassador.status === 'ACTIVE' ? '#D4EDDA' : '#FFF3CD' }
            ]}>
              <Text style={[
                styles.statusPillText,
                { color: ambassador.status === 'ACTIVE' ? '#155724' : '#856404' }
              ]}>
                {ambassador.status === 'ACTIVE' ? '✅ Active' : '⏳ Pending'}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#8B3A3A' }]}>R{totalEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#856404' }]}>{pendingCommissions}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#155724' }]}>{paidCommissions}</Text>
            <Text style={styles.statLabel}>Paid Out</Text>
          </View>
        </View>

        {/* Referral Code */}
        {ambassador?.code && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <Text style={styles.code}>{ambassador.code}</Text>
            <Text style={styles.codeHint}>
              Earn {(Number(ambassador.commissionRate) * 100).toFixed(0)}% commission on every order
            </Text>
            <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
              <Text style={styles.shareBtnText}>📤  Share My Code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(ambassador)/orders')}
          >
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionLabel}>View All Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(ambassador)/profile')}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionLabel}>My Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {orders.length > 5 && (
              <TouchableOpacity onPress={() => router.push('/(ambassador)/orders')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentOrders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyOrdersIcon}>📭</Text>
              <Text style={styles.emptyOrdersText}>No orders yet</Text>
              <Text style={styles.emptyOrdersSub}>Share your code to start earning</Text>
            </View>
          ) : (
            recentOrders.map((order: any) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderRow}>
                  <View style={styles.orderCustomerInitial}>
                    <Text style={styles.orderCustomerInitialText}>
                      {order.customer?.firstName?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderCustomer}>
                      {order.customer?.firstName} {order.customer?.lastName}
                    </Text>
                    <Text style={styles.orderStatus}>{order.status}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.orderAmount}>R{Number(order.total).toFixed(2)}</Text>
                    {order.commission && (
                      <Text style={styles.commission}>
                        +R{Number(order.commission.amount).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <AmbassadorTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6F0' },
  scrollContent: {},
  header: {
    backgroundColor: '#8B3A3A',
    padding: 20,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: '#f5d0d0', marginTop: 2 },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5eded',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FDF6F0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 10, color: '#999', marginTop: 3, textAlign: 'center' },
  codeCard: {
    backgroundColor: '#8B3A3A',
    margin: 16,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#8B3A3A',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  codeLabel: { color: '#f5d0d0', fontSize: 13, marginBottom: 6 },
  code: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  codeHint: { color: '#f5d0d0', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  shareBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shareBtnText: { color: '#8B3A3A', fontWeight: '700', fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 16 },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', textAlign: 'center' },
  recentSection: { paddingHorizontal: 16 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  seeAll: { fontSize: 14, color: '#8B3A3A', fontWeight: '600' },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderCustomerInitial: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCustomerInitialText: { fontSize: 15, fontWeight: '700', color: '#8B3A3A' },
  orderCustomer: { fontWeight: '600', color: '#1a1a1a', fontSize: 14 },
  orderAmount: { fontWeight: '700', color: '#1a1a1a', fontSize: 15 },
  orderStatus: { fontSize: 12, color: '#999', marginTop: 1 },
  commission: { fontSize: 12, color: '#2E7D32', fontWeight: '700', marginTop: 2 },
  emptyOrders: { alignItems: 'center', paddingVertical: 32 },
  emptyOrdersIcon: { fontSize: 40, marginBottom: 12 },
  emptyOrdersText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  emptyOrdersSub: { fontSize: 13, color: '#999' },
})
