import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ordersApi, ambassadorsApi } from '../services/api'

// ─── Tiny bar-chart built from Views ────────────────────────────────────────
interface BarChartProps {
  data: { label: string; value: number; color?: string }[]
  valuePrefix?: string
  maxValue?: number
}

function BarChart({ data, valuePrefix = '', maxValue }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <View style={chart.container}>
      {data.map((bar, i) => (
        <View key={i} style={chart.barGroup}>
          <Text style={chart.barValue}>
            {valuePrefix}{bar.value > 0 ? (bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value.toFixed(0)) : '–'}
          </Text>
          <View style={chart.barTrack}>
            <View
              style={[
                chart.barFill,
                {
                  height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 4 : 0)}%`,
                  backgroundColor: bar.color ?? '#8B3A3A',
                },
              ]}
            />
          </View>
          <Text style={chart.barLabel} numberOfLines={1}>{bar.label}</Text>
        </View>
      ))}
    </View>
  )
}

const chart = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
  barGroup: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 9, color: '#888', fontWeight: '600' },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5eded',
    borderRadius: 4,
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9, color: '#aaa', fontWeight: '500', width: '100%', textAlign: 'center' },
})

// ─── Mini progress bar ───────────────────────────────────────────────────────
function ProgressBar({ value, max, color = '#8B3A3A' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <View style={prog.track}>
      <View style={[prog.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  )
}

const prog = StyleSheet.create({
  track: { height: 6, backgroundColor: '#f0e8e8', borderRadius: 3, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 3 },
})

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, accent,
}: { icon: string; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <View style={[sc.card, accent && sc.cardAccent]}>
      <Text style={sc.icon}>{icon}</Text>
      <Text style={[sc.value, accent && sc.valueAccent]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  )
}

const sc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardAccent: { backgroundColor: '#8B3A3A' },
  icon: { fontSize: 22, marginBottom: 6 },
  value: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  valueAccent: { color: '#fff' },
  label: { fontSize: 11, color: '#999', marginTop: 2, textAlign: 'center' },
  sub: { fontSize: 10, color: '#bbb', marginTop: 2 },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getLast6Months(): { key: string; label: string }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTHS[d.getMonth()] }
  })
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Customer Report
// ═══════════════════════════════════════════════════════════════════════════
function CustomerReport() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await ordersApi.getMy()
      setOrders(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#8B3A3A" size="large" />

  const completed = orders.filter((o) => o.status === 'DELIVERED')
  const totalSpent = completed.reduce((s, o) => s + Number(o.total), 0)
  const avgOrder = completed.length ? totalSpent / completed.length : 0
  const pending = orders.filter((o) => ['PENDING', 'CONFIRMED', 'BAKING', 'READY'].includes(o.status)).length
  const cancelled = orders.filter((o) => o.status === 'CANCELLED').length

  // Monthly spend (last 6)
  const months = getLast6Months()
  const monthlySpend = months.map((m) => ({
    label: m.label,
    value: orders
      .filter((o) => o.status === 'DELIVERED' && monthKey(o.createdAt) === m.key)
      .reduce((s, o) => s + Number(o.total), 0),
  }))

  // Top products
  const productTotals: Record<string, { name: string; qty: number; spent: number }> = {}
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const name = item.variant?.product?.name ?? 'Unknown'
      if (!productTotals[name]) productTotals[name] = { name, qty: 0, spent: 0 }
      productTotals[name].qty += item.quantity
      productTotals[name].spent += Number(item.subtotal ?? item.unitPrice * item.quantity)
    }
  }
  const topProducts = Object.values(productTotals).sort((a, b) => b.qty - a.qty).slice(0, 5)
  const maxQty = Math.max(...topProducts.map((p) => p.qty), 1)

  // Status breakdown
  const statusBreakdown = [
    { label: 'Delivered', value: completed.length, color: '#8B3A3A' },
    { label: 'Active', value: pending, color: '#3B82F6' },
    { label: 'Cancelled', value: cancelled, color: '#EF4444' },
  ].filter((s) => s.value > 0)

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#8B3A3A" />}
    >
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>Place your first order to see your spending report</Text>
        </View>
      ) : (
        <>
          {/* Summary cards */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.cardRow}>
            <StatCard icon="📦" label="Total Orders" value={String(orders.length)} accent />
            <StatCard icon="✅" label="Delivered" value={String(completed.length)} sub={`${orders.length ? Math.round((completed.length / orders.length) * 100) : 0}% completion`} />
          </View>
          <View style={[styles.cardRow, { marginTop: 10 }]}>
            <StatCard icon="💰" label="Total Spent" value={`R${totalSpent.toFixed(0)}`} sub="delivered orders only" />
            <StatCard icon="🧾" label="Avg Order" value={`R${avgOrder.toFixed(0)}`} />
          </View>

          {/* Monthly spending */}
          <Text style={styles.sectionTitle}>Monthly Spending</Text>
          <View style={styles.card}>
            <BarChart data={monthlySpend} valuePrefix="R" />
          </View>

          {/* Order status breakdown */}
          {statusBreakdown.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Order Status Breakdown</Text>
              <View style={styles.card}>
                {statusBreakdown.map((s) => (
                  <View key={s.label} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{s.label}</Text>
                    <ProgressBar value={s.value} max={orders.length} color={s.color} />
                    <Text style={styles.breakdownCount}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Top products */}
          {topProducts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Top Products Ordered</Text>
              <View style={styles.card}>
                {topProducts.map((p, i) => (
                  <View key={p.name} style={[styles.productRow, i < topProducts.length - 1 && styles.productRowBorder]}>
                    <View style={styles.productRank}>
                      <Text style={styles.productRankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{p.name}</Text>
                      <ProgressBar value={p.qty} max={maxQty} />
                    </View>
                    <View style={styles.productStats}>
                      <Text style={styles.productQty}>{p.qty}×</Text>
                      <Text style={styles.productSpent}>R{p.spent.toFixed(0)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Ambassador Report
// ═══════════════════════════════════════════════════════════════════════════
function AmbassadorReport() {
  const [orders, setOrders] = useState<any[]>([])
  const [ambassador, setAmbassador] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [ords, amb] = await Promise.all([ordersApi.getAmbassador(), ambassadorsApi.me()])
      setOrders(ords)
      setAmbassador(amb)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#8B3A3A" size="large" />

  const rate = Number(ambassador?.commissionRate ?? 0)
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)
  const totalCommission = totalRevenue * rate
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED')
  const deliveredRevenue = deliveredOrders.reduce((s, o) => s + Number(o.total), 0)
  const earnedCommission = deliveredRevenue * rate
  const pendingCommission = totalCommission - earnedCommission
  const conversionRate = orders.length > 0
    ? Math.round((deliveredOrders.length / orders.length) * 100)
    : 0

  // Monthly attributed orders + commission (last 6)
  const months = getLast6Months()
  const monthlyOrders = months.map((m) => ({
    label: m.label,
    value: orders.filter((o) => monthKey(o.createdAt) === m.key).length,
  }))
  const monthlyCommission = months.map((m) => ({
    label: m.label,
    value: orders
      .filter((o) => o.status === 'DELIVERED' && monthKey(o.createdAt) === m.key)
      .reduce((s, o) => s + Number(o.total) * rate, 0),
  }))

  // Top customers
  const customerMap: Record<string, { name: string; orders: number; total: number }> = {}
  for (const o of orders) {
    const id = o.customer?.id ?? 'unknown'
    const name = `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim() || 'Customer'
    if (!customerMap[id]) customerMap[id] = { name, orders: 0, total: 0 }
    customerMap[id].orders += 1
    customerMap[id].total += Number(o.total)
  }
  const topCustomers = Object.values(customerMap).sort((a, b) => b.total - a.total).slice(0, 5)

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#8B3A3A" />}
    >
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>Share your referral code to start earning commission</Text>
        </View>
      ) : (
        <>
          {/* Commission rate banner */}
          <View style={styles.rateBanner}>
            <Text style={styles.rateBannerLabel}>Your Commission Rate</Text>
            <Text style={styles.rateBannerValue}>{(rate * 100).toFixed(0)}%</Text>
            <Text style={styles.rateBannerSub}>of every delivered order value</Text>
          </View>

          {/* Summary */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.cardRow}>
            <StatCard icon="📦" label="Orders Attributed" value={String(orders.length)} accent />
            <StatCard icon="🚚" label="Delivered" value={String(deliveredOrders.length)} sub={`${conversionRate}% conversion`} />
          </View>
          <View style={[styles.cardRow, { marginTop: 10 }]}>
            <StatCard icon="✅" label="Commission Earned" value={`R${earnedCommission.toFixed(0)}`} sub="from delivered orders" />
            <StatCard icon="⏳" label="Pending" value={`R${pendingCommission.toFixed(0)}`} sub="awaiting delivery" />
          </View>

          {/* Monthly orders chart */}
          <Text style={styles.sectionTitle}>Monthly Orders Attributed</Text>
          <View style={styles.card}>
            <BarChart data={monthlyOrders} />
          </View>

          {/* Monthly commission chart */}
          <Text style={styles.sectionTitle}>Monthly Commission Earned</Text>
          <View style={styles.card}>
            <BarChart data={monthlyCommission} valuePrefix="R" />
          </View>

          {/* Commission breakdown */}
          <Text style={styles.sectionTitle}>Commission Breakdown</Text>
          <View style={styles.card}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Earned (delivered)</Text>
              <ProgressBar value={earnedCommission} max={totalCommission} color="#8B3A3A" />
              <Text style={styles.breakdownCount}>R{earnedCommission.toFixed(0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Pending</Text>
              <ProgressBar value={pendingCommission} max={totalCommission} color="#F59E0B" />
              <Text style={styles.breakdownCount}>R{pendingCommission.toFixed(0)}</Text>
            </View>
            <View style={[styles.breakdownRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f5eded', paddingTop: 12 }]}>
              <Text style={[styles.breakdownLabel, { fontWeight: '700', color: '#1a1a1a' }]}>Total</Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.breakdownCount, { fontWeight: '800', color: '#8B3A3A', fontSize: 16 }]}>
                R{totalCommission.toFixed(0)}
              </Text>
            </View>
          </View>

          {/* Top customers */}
          {topCustomers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Top Customers</Text>
              <View style={styles.card}>
                {topCustomers.map((c, i) => (
                  <View key={c.name + i} style={[styles.productRow, i < topCustomers.length - 1 && styles.productRowBorder]}>
                    <View style={styles.productRank}>
                      <Text style={styles.productRankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{c.name}</Text>
                      <Text style={styles.productQtySmall}>{c.orders} order{c.orders !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.productStats}>
                      <Text style={styles.productQty}>R{c.total.toFixed(0)}</Text>
                      <Text style={styles.productSpent}>+R{(c.total * rate).toFixed(0)} comm.</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Root export
// ═══════════════════════════════════════════════════════════════════════════
interface Props { role: 'customer' | 'ambassador' }

export default function ReportsScreen({ role }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSub}>
            {role === 'ambassador' ? 'Commission & attribution' : 'Spending & order history'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {role === 'ambassador' ? <AmbassadorReport /> : <CustomerReport />}
    </View>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },

  header: {
    backgroundColor: '#8B3A3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#f5d0d0', marginTop: 1 },

  scrollContent: { padding: 16 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 2,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },

  cardRow: { flexDirection: 'row', gap: 10 },

  // Rate banner (ambassador)
  rateBanner: {
    backgroundColor: '#8B3A3A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#8B3A3A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  rateBannerLabel: { fontSize: 12, color: '#f5d0d0', marginBottom: 4 },
  rateBannerValue: { fontSize: 48, fontWeight: '900', color: '#fff', lineHeight: 56 },
  rateBannerSub: { fontSize: 12, color: '#f5d0d0', marginTop: 2 },

  // Breakdown rows
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  breakdownLabel: { fontSize: 13, color: '#555', width: 80 },
  breakdownCount: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', width: 44, textAlign: 'right' },

  // Product / customer rows
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  productRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f7efef' },
  productRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productRankText: { fontSize: 13, fontWeight: '800', color: '#8B3A3A' },
  productInfo: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  productQtySmall: { fontSize: 11, color: '#999' },
  productStats: { alignItems: 'flex-end' },
  productQty: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  productSpent: { fontSize: 11, color: '#999', marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center', paddingHorizontal: 20 },
})
