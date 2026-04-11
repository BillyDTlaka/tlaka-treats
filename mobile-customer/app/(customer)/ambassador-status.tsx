import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ambassadorsApi } from '../../services/api'

interface Ambassador {
  id: string
  status: string        // PENDING | ACTIVE | SUSPENDED
  kycStatus: string     // NOT_STARTED | SUBMITTED | APPROVED | REJECTED
  kycNote: string | null
  kycData: any
  commissionRate: number
  code: string
  createdAt: string
}

const STATUS_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; message: string }> = {
  PENDING: {
    emoji: '⏳',
    label: 'Under Review',
    color: '#856404',
    bg: '#FFF3CD',
    message: 'Your application has been received and is being reviewed by our team. We\'ll notify you once a decision has been made.',
  },
  ACTIVE: {
    emoji: '✅',
    label: 'Active',
    color: '#155724',
    bg: '#D4EDDA',
    message: 'Congratulations! Your ambassador account is active. You can now access your ambassador dashboard and start earning commissions.',
  },
  SUSPENDED: {
    emoji: '⚠️',
    label: 'Suspended',
    color: '#721C24',
    bg: '#F8D7DA',
    message: 'Your ambassador account has been suspended. Please contact us for more information.',
  },
}

const KYC_STEPS = [
  { key: 'applied',   label: 'Application submitted',  doneWhen: () => true },
  { key: 'kyc',       label: 'Documents under review',  doneWhen: (a: Ambassador) => ['SUBMITTED', 'APPROVED'].includes(a.kycStatus) },
  { key: 'approved',  label: 'Application approved',    doneWhen: (a: Ambassador) => a.kycStatus === 'APPROVED' || a.status === 'ACTIVE' },
  { key: 'active',    label: 'Account activated',       doneWhen: (a: Ambassador) => a.status === 'ACTIVE' },
]

export default function AmbassadorStatus() {
  const insets = useSafeAreaInsets()
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await ambassadorsApi.myApplication()
      setAmbassador(data)
    } catch {
      setAmbassador(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B3A3A" />
      </View>
    )
  }

  if (!ambassador) {
    // Not yet applied — redirect to apply form
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notAppliedEmoji}>🌟</Text>
        <Text style={styles.notAppliedTitle}>No application found</Text>
        <Text style={styles.notAppliedSub}>You haven't applied to become an ambassador yet.</Text>
        <TouchableOpacity style={styles.applyBtn} onPress={() => router.replace('/(customer)/ambassador-apply' as any)}>
          <Text style={styles.applyBtnText}>Apply Now</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const statusCfg = STATUS_CONFIG[ambassador.status] ?? STATUS_CONFIG.PENDING
  const banking = ambassador.kycData?.banking

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application Status</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B3A3A" />}
      >
        {/* Status badge */}
        <View style={[styles.statusCard, { backgroundColor: statusCfg.bg }]}>
          <Text style={styles.statusEmoji}>{statusCfg.emoji}</Text>
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          <Text style={[styles.statusMessage, { color: statusCfg.color }]}>{statusCfg.message}</Text>
          {ambassador.status === 'ACTIVE' && (
            <TouchableOpacity
              style={styles.dashboardBtn}
              onPress={() => router.replace('/(ambassador)/dashboard' as any)}
            >
              <Text style={styles.dashboardBtnText}>Go to Ambassador Dashboard →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* KYC rejection reason */}
        {ambassador.kycStatus === 'REJECTED' && ambassador.kycNote && (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionTitle}>❌ Application not approved</Text>
            <Text style={styles.rejectionReason}>{ambassador.kycNote}</Text>
            <TouchableOpacity style={styles.reapplyBtn} onPress={() => router.push('/(customer)/ambassador-apply' as any)}>
              <Text style={styles.reapplyBtnText}>Update & Resubmit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress steps */}
        <Text style={styles.sectionTitle}>Application Progress</Text>
        <View style={styles.stepsCard}>
          {KYC_STEPS.map((step, idx) => {
            const done = step.doneWhen(ambassador)
            const isLast = idx === KYC_STEPS.length - 1
            return (
              <View key={step.key}>
                <View style={styles.stepRow}>
                  <View style={[styles.stepDot, done && styles.stepDotDone]}>
                    <Text style={styles.stepDotText}>{done ? '✓' : (idx + 1).toString()}</Text>
                  </View>
                  <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                </View>
                {!isLast && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
              </View>
            )
          })}
        </View>

        {/* Application details */}
        <Text style={styles.sectionTitle}>Your Details</Text>
        <View style={styles.detailsCard}>
          <DetailRow label="Submitted" value={new Date(ambassador.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} />
          {ambassador.kycData?.phone && <DetailRow label="Phone" value={ambassador.kycData.phone} />}
          {ambassador.kycData?.idType && <DetailRow label="ID Type" value={ambassador.kycData.idType} />}
          {ambassador.kycData?.idNumber && <DetailRow label="ID Number" value={`••••••${ambassador.kycData.idNumber.slice(-4)}`} />}
          {ambassador.status === 'ACTIVE' && (
            <>
              <DetailRow label="Referral Code" value={ambassador.code} highlight />
              <DetailRow label="Commission Rate" value={`${(ambassador.commissionRate * 100).toFixed(0)}%`} highlight />
            </>
          )}
        </View>

        {/* Banking details */}
        {banking && (
          <>
            <Text style={styles.sectionTitle}>Banking Details</Text>
            <View style={styles.detailsCard}>
              <DetailRow label="Bank" value={banking.bankName} />
              <DetailRow label="Account Holder" value={banking.accountName} />
              <DetailRow label="Account Number" value={`••••••${banking.accountNumber?.slice(-4)}`} />
              <DetailRow label="Branch Code" value={banking.branchCode} />
              <DetailRow label="Account Type" value={banking.accountType} />
            </View>
          </>
        )}

        <Text style={styles.pullHint}>Pull down to refresh status</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6F0', padding: 32 },
  notAppliedEmoji: { fontSize: 48, marginBottom: 16 },
  notAppliedTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  notAppliedSub: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 },
  applyBtn: { backgroundColor: '#8B3A3A', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  header: { backgroundColor: '#8B3A3A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scrollContent: { padding: 20 },

  statusCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusLabel: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  statusMessage: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  dashboardBtn: { marginTop: 16, backgroundColor: '#155724', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  dashboardBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  rejectionCard: { backgroundColor: '#F8D7DA', borderRadius: 16, padding: 18, marginBottom: 16 },
  rejectionTitle: { fontSize: 15, fontWeight: '700', color: '#721C24', marginBottom: 8 },
  rejectionReason: { fontSize: 13, color: '#721C24', lineHeight: 20, marginBottom: 14 },
  reapplyBtn: { backgroundColor: '#721C24', borderRadius: 10, padding: 12, alignItems: 'center' },
  reapplyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 12, marginTop: 8 },

  stepsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8d5d5', justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: '#8B3A3A' },
  stepDotText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  stepLabel: { fontSize: 14, color: '#999', fontWeight: '500' },
  stepLabelDone: { color: '#1a1a1a', fontWeight: '700' },
  stepLine: { width: 2, height: 20, backgroundColor: '#e8d5d5', marginLeft: 15, marginVertical: 2 },
  stepLineDone: { backgroundColor: '#8B3A3A' },

  detailsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5eded' },
  detailLabel: { fontSize: 13, color: '#999' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  detailValueHighlight: { color: '#8B3A3A', fontSize: 15 },

  pullHint: { fontSize: 12, color: '#ccc', textAlign: 'center', marginTop: 8 },
})
