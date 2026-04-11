import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ambassadorsApi } from '../../services/api'
import AmbassadorTabBar from '../../components/AmbassadorTabBar'

const COMMISSION_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#FFF3CD', text: '#856404', label: 'Pending' },
  PAID:    { bg: '#D4EDDA', text: '#155724', label: 'Paid' },
}

const PAYOUT_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: '⏳ Requested' },
  APPROVED:  { bg: '#D1ECF1', text: '#0C5460', label: '✅ Approved' },
  PAID:      { bg: '#D4EDDA', text: '#155724', label: '💸 Paid' },
  REJECTED:  { bg: '#F8D7DA', text: '#721C24', label: '✗ Rejected' },
}

const PAYMENT_METHODS = [
  { key: 'bank_transfer', label: '🏦 Bank Transfer' },
  { key: 'cash',          label: '💵 Cash' },
  { key: 'mobile_money',  label: '📱 Mobile Money' },
]

export default function EarningsScreen() {
  const insets = useSafeAreaInsets()
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab]           = useState<'commissions' | 'payouts'>('commissions')
  const [showModal, setShowModal] = useState(false)
  const [method, setMethod]     = useState('bank_transfer')
  const [notes, setNotes]       = useState('')
  const [requesting, setRequesting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await ambassadorsApi.earnings()
      setData(res)
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not load earnings')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const onRefresh = () => { setRefreshing(true); fetchData() }

  const handleRequestPayout = async () => {
    setRequesting(true)
    try {
      const res = await ambassadorsApi.requestPayout(method, notes.trim() || undefined)
      setShowModal(false)
      setNotes('')
      await fetchData()
      Alert.alert(
        'Payout Requested! 🎉',
        `R${Number(res.total).toFixed(2)} across ${res.commissionCount} commission(s) has been submitted for payment. We'll process it shortly.`,
        [{ text: 'Got it' }]
      )
    } catch (err: any) {
      Alert.alert('Request Failed', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setRequesting(false)
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B3A3A" />
      </View>
    )
  }

  const { summary, commissions = [], payouts = [], commissionRate } = data ?? {}
  const hasPending = summary?.totalPending > 0
  const canRequestPayout = hasPending && summary?.totalPending >= 50

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B3A3A" />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.summaryCardAccent]}>
            <Text style={styles.summaryCardLabelLight}>Available to Withdraw</Text>
            <Text style={styles.summaryCardValueLarge}>R{Number(summary?.totalPending ?? 0).toFixed(2)}</Text>
            <Text style={styles.summaryCardSubLight}>{summary?.pendingCount ?? 0} pending commission(s)</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCardSmall}>
              <Text style={styles.summaryCardLabel}>Total Earned</Text>
              <Text style={styles.summaryCardValue}>R{Number(summary?.totalEarned ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryCardSmall}>
              <Text style={styles.summaryCardLabel}>Total Paid Out</Text>
              <Text style={[styles.summaryCardValue, { color: '#059669' }]}>
                R{Number(summary?.totalPaid ?? 0).toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryCardSmall}>
            <Text style={styles.summaryCardLabel}>Commission Rate</Text>
            <Text style={[styles.summaryCardValue, { color: '#8B3A3A' }]}>
              {(Number(commissionRate ?? 0) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Request Payout Button */}
        {hasPending && (
          <View style={styles.payoutButtonSection}>
            {canRequestPayout ? (
              <TouchableOpacity
                style={styles.payoutBtn}
                onPress={() => setShowModal(true)}
              >
                <Text style={styles.payoutBtnText}>Request Payout · R{Number(summary.totalPending).toFixed(2)}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.minNotice}>
                <Text style={styles.minNoticeText}>
                  💡 Minimum payout is R50.00. You have R{Number(summary.totalPending).toFixed(2)} pending.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'commissions' && styles.tabBtnActive]}
            onPress={() => setTab('commissions')}
          >
            <Text style={[styles.tabBtnText, tab === 'commissions' && styles.tabBtnTextActive]}>
              Commissions ({commissions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'payouts' && styles.tabBtnActive]}
            onPress={() => setTab('payouts')}
          >
            <Text style={[styles.tabBtnText, tab === 'payouts' && styles.tabBtnTextActive]}>
              Payouts ({payouts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Commissions List */}
        {tab === 'commissions' && (
          commissions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No commissions yet</Text>
              <Text style={styles.emptySub}>Share your referral code to start earning</Text>
            </View>
          ) : (
            commissions.map((c: any) => {
              const s = COMMISSION_STATUS[c.status] ?? { bg: '#eee', text: '#666', label: c.status }
              return (
                <View key={c.id} style={styles.commissionCard}>
                  <View style={styles.commissionRow}>
                    <View style={styles.commissionLeft}>
                      <Text style={styles.commissionAmount}>+R{Number(c.amount).toFixed(2)}</Text>
                      <Text style={styles.commissionDate}>{formatDate(c.createdAt)}</Text>
                    </View>
                    <View style={styles.commissionRight}>
                      <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                        <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                      </View>
                      <Text style={styles.commissionOrderRef}>
                        Order #{c.order?.id?.slice(-6).toUpperCase() ?? '—'}
                      </Text>
                    </View>
                  </View>
                  {c.payout && (
                    <Text style={styles.commissionPayoutRef}>
                      Included in payout · {formatDate(c.payout.createdAt)}
                    </Text>
                  )}
                </View>
              )
            })
          )
        )}

        {/* Payouts List */}
        {tab === 'payouts' && (
          payouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyTitle}>No payouts yet</Text>
              <Text style={styles.emptySub}>Request your first payout once you have R50+ pending</Text>
            </View>
          ) : (
            payouts.map((p: any) => {
              const s = PAYOUT_STATUS[p.status] ?? { bg: '#eee', text: '#666', label: p.status }
              return (
                <View key={p.id} style={styles.payoutCard}>
                  <View style={styles.payoutCardHeader}>
                    <View>
                      <Text style={styles.payoutAmount}>R{Number(p.amount).toFixed(2)}</Text>
                      <Text style={styles.payoutDate}>{formatDate(p.createdAt)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                    </View>
                  </View>
                  <View style={styles.payoutMeta}>
                    <Text style={styles.payoutMetaText}>
                      {PAYMENT_METHODS.find(m => m.key === p.method)?.label ?? p.method}
                    </Text>
                    {p.reference && (
                      <Text style={styles.payoutRef}>Ref: {p.reference}</Text>
                    )}
                  </View>
                  {p.notes && <Text style={styles.payoutNotes}>{p.notes}</Text>}
                </View>
              )
            })
          )
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <AmbassadorTabBar />

      {/* Payout Request Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !requesting && setShowModal(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Request Payout</Text>
            <Text style={styles.modalSubtitle}>
              R{Number(summary?.totalPending ?? 0).toFixed(2)} across {summary?.pendingCount} commission(s)
            </Text>

            <Text style={styles.fieldLabel}>Payment Method</Text>
            <View style={styles.methodList}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.methodItem, method === m.key && styles.methodItemActive]}
                  onPress={() => setMethod(m.key)}
                >
                  <Text style={[styles.methodItemText, method === m.key && styles.methodItemTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. FNB account ending 1234..."
              placeholderTextColor="#bbb"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, requesting && styles.confirmBtnDisabled]}
              onPress={handleRequestPayout}
              disabled={requesting}
            >
              {requesting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Submit Request</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowModal(false)}
              disabled={requesting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6F0' },
  header: {
    backgroundColor: '#8B3A3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scrollContent: { padding: 16 },

  // Summary
  summaryGrid: { gap: 10, marginBottom: 16 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryCardAccent: { backgroundColor: '#8B3A3A' },
  summaryCardLabelLight: { fontSize: 13, color: '#f5d0d0', marginBottom: 4 },
  summaryCardValueLarge: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 4 },
  summaryCardSubLight: { fontSize: 12, color: '#f5d0d0' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCardSmall: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryCardLabel: { fontSize: 12, color: '#999', marginBottom: 6 },
  summaryCardValue: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },

  // Payout button
  payoutButtonSection: { marginBottom: 16 },
  payoutBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  payoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  minNotice: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  minNoticeText: { fontSize: 13, color: '#856404', lineHeight: 18 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0e8e8',
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#8B3A3A' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#999' },
  tabBtnTextActive: { color: '#fff' },

  // Commission cards
  commissionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  commissionLeft: {},
  commissionAmount: { fontSize: 18, fontWeight: '800', color: '#059669' },
  commissionDate: { fontSize: 12, color: '#999', marginTop: 2 },
  commissionRight: { alignItems: 'flex-end', gap: 4 },
  commissionOrderRef: { fontSize: 11, color: '#bbb' },
  commissionPayoutRef: { fontSize: 11, color: '#8B3A3A', marginTop: 8, fontWeight: '600' },

  // Payout cards
  payoutCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  payoutCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  payoutAmount: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  payoutDate: { fontSize: 12, color: '#999', marginTop: 2 },
  payoutMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payoutMetaText: { fontSize: 13, color: '#555', fontWeight: '600' },
  payoutRef: { fontSize: 12, color: '#8B3A3A', fontWeight: '600' },
  payoutNotes: { fontSize: 12, color: '#999', marginTop: 8, fontStyle: 'italic' },

  // Status badge
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#999', textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#8B3A3A', fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  methodList: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  methodItem: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e8d5d5',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  methodItemActive: { borderColor: '#8B3A3A', backgroundColor: '#FFF0E6' },
  methodItemText: { fontSize: 12, color: '#999', fontWeight: '600', textAlign: 'center' },
  methodItemTextActive: { color: '#8B3A3A' },
  notesInput: {
    backgroundColor: '#FDF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8d5d5',
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  confirmBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelBtnText: { fontSize: 15, color: '#999', fontWeight: '600' },
})
