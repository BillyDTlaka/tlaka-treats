import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, RefreshControl, Modal, TextInput, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ambassadorsApi, ordersApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import AmbassadorTabBar from '../../components/AmbassadorTabBar'

type Preset = '30d' | '3m' | '6m' | '1y' | 'all' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: '30d',    label: '30 Days'  },
  { key: '3m',     label: '3 Months' },
  { key: '6m',     label: '6 Months' },
  { key: '1y',     label: '1 Year'   },
  { key: 'all',    label: 'All Time' },
  { key: 'custom', label: 'Custom'   },
]

function getPresetRange(preset: Preset): { from: Date; to: Date } | null {
  if (preset === 'all' || preset === 'custom') return null
  const to = new Date()
  const from = new Date()
  if (preset === '30d') from.setDate(from.getDate() - 30)
  else if (preset === '3m') from.setMonth(from.getMonth() - 3)
  else if (preset === '6m') from.setMonth(from.getMonth() - 6)
  else if (preset === '1y') from.setFullYear(from.getFullYear() - 1)
  return { from, to }
}

function formatPeriodLabel(preset: Preset, customFrom?: Date, customTo?: Date): string {
  if (preset === 'all') return 'All time'
  if (preset === 'custom' && customFrom && customTo) {
    return `${customFrom.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} – ${customTo.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  const range = getPresetRange(preset)
  if (!range) return ''
  return `${range.from.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} – ${range.to.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
}

function parseDate(str: string): Date | null {
  // Accept DD/MM/YYYY or YYYY-MM-DD
  const parts = str.includes('/') ? str.split('/') : str.split('-')
  if (parts.length !== 3) return null
  let day: number, month: number, year: number
  if (str.includes('/')) {
    ;[day, month, year] = parts.map(Number)
  } else {
    ;[year, month, day] = parts.map(Number)
  }
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  const d = new Date(year, month - 1, day)
  return isNaN(d.getTime()) ? null : d
}

export default function AmbassadorDashboard() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [ambassador, setAmbassador] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [preset, setPreset] = useState<Preset>('3m')
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customFromStr, setCustomFromStr] = useState('')
  const [customToStr, setCustomToStr] = useState('')
  const [customFrom, setCustomFrom] = useState<Date | undefined>()
  const [customTo, setCustomTo] = useState<Date | undefined>()

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

  const applyCustomRange = () => {
    const from = parseDate(customFromStr)
    const to = parseDate(customToStr)
    if (!from) return Alert.alert('Invalid Date', 'Enter the start date as DD/MM/YYYY')
    if (!to) return Alert.alert('Invalid Date', 'Enter the end date as DD/MM/YYYY')
    if (from > to) return Alert.alert('Invalid Range', 'Start date must be before end date')
    to.setHours(23, 59, 59, 999)
    setCustomFrom(from)
    setCustomTo(to)
    setPreset('custom')
    setShowCustomModal(false)
  }

  // Derive filtered orders from current period selection
  const filteredOrders = useMemo(() => {
    let from: Date | undefined
    let to: Date | undefined
    if (preset === 'custom') {
      from = customFrom
      to = customTo
    } else {
      const range = getPresetRange(preset)
      if (range) { from = range.from; to = range.to }
    }
    if (!from && !to) return orders
    return orders.filter((o: any) => {
      const d = new Date(o.createdAt)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
  }, [orders, preset, customFrom, customTo])

  const totalEarnings = filteredOrders.reduce(
    (sum: number, o: any) => sum + (o.commission?.amount ? Number(o.commission.amount) : 0), 0
  )
  const pendingCommissions = filteredOrders.filter((o: any) => o.commission?.status === 'PENDING').length
  const paidCommissions = filteredOrders.filter((o: any) => o.commission?.status === 'PAID').length
  const recentOrders = filteredOrders.slice(0, 5)
  const periodLabel = formatPeriodLabel(preset, customFrom, customTo)

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

        {/* Period Selector */}
        <View style={styles.periodBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodPill, preset === p.key && styles.periodPillActive]}
                onPress={() => {
                  if (p.key === 'custom') {
                    setShowCustomModal(true)
                  } else {
                    setPreset(p.key)
                  }
                }}
              >
                <Text style={[styles.periodPillText, preset === p.key && styles.periodPillTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Period label + order count */}
        <View style={styles.periodSummaryRow}>
          <Text style={styles.periodSummaryLabel}>{periodLabel}</Text>
          <Text style={styles.periodSummaryCount}>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{filteredOrders.length}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.statCard, { flex: 1.6 }]}>
            <Text
              style={[styles.statValue, { color: '#8B3A3A', fontSize: 14 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              R{totalEarnings.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
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
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(ambassador)/orders')}>
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionLabel}>View All Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(ambassador)/earnings' as any)}>
            <Text style={styles.actionIcon}>💸</Text>
            <Text style={styles.actionLabel}>Earnings & Payouts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(ambassador)/profile')}>
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionLabel}>My Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Orders in Period</Text>
            {filteredOrders.length > 5 && (
              <TouchableOpacity onPress={() => router.push('/(ambassador)/orders')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentOrders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Text style={styles.emptyOrdersIcon}>📭</Text>
              <Text style={styles.emptyOrdersText}>No orders in this period</Text>
              <Text style={styles.emptyOrdersSub}>Try a wider date range or share your code</Text>
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
                    <Text style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
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

      {/* Custom Date Range Modal */}
      <Modal visible={showCustomModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Custom Date Range</Text>
            <Text style={styles.modalHint}>Enter dates as DD/MM/YYYY</Text>

            <Text style={styles.modalLabel}>From</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="01/01/2025"
              placeholderTextColor="#bbb"
              value={customFromStr}
              onChangeText={setCustomFromStr}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.modalLabel}>To</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="31/03/2025"
              placeholderTextColor="#bbb"
              value={customToStr}
              onChangeText={setCustomToStr}
              keyboardType="numbers-and-punctuation"
            />

            <TouchableOpacity style={styles.modalApplyBtn} onPress={applyCustomRange}>
              <Text style={styles.modalApplyText}>Apply Range</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCustomModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

  // Period selector
  periodBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0e8e8' },
  periodScroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  periodPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FDF6F0',
    borderWidth: 1,
    borderColor: '#e8d5d5',
  },
  periodPillActive: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  periodPillText: { fontSize: 13, fontWeight: '600', color: '#8B3A3A' },
  periodPillTextActive: { color: '#fff' },

  periodSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  periodSummaryLabel: { fontSize: 12, color: '#999' },
  periodSummaryCount: { fontSize: 12, color: '#8B3A3A', fontWeight: '600' },

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
  shareBtn: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
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
  orderDate: { fontSize: 11, color: '#aaa', marginTop: 1 },
  orderStatus: { fontSize: 12, color: '#999', marginTop: 1 },
  orderAmount: { fontWeight: '700', color: '#1a1a1a', fontSize: 15 },
  commission: { fontSize: 12, color: '#2E7D32', fontWeight: '700', marginTop: 2 },

  emptyOrders: { alignItems: 'center', paddingVertical: 32 },
  emptyOrdersIcon: { fontSize: 40, marginBottom: 12 },
  emptyOrdersText: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  emptyOrdersSub: { fontSize: 13, color: '#999' },

  // Custom date modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  modalHint: { fontSize: 13, color: '#999', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 6 },
  modalInput: {
    backgroundColor: '#FDF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8d5d5',
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  modalApplyBtn: {
    backgroundColor: '#8B3A3A',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalApplyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { fontSize: 15, color: '#999', fontWeight: '600' },
})
