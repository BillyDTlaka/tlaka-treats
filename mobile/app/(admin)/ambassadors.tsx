import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, TextInput, Linking, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api } from '../../lib/api'
import { COLORS, BRAND } from '../../lib/theme'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { useFocusEffect } from 'expo-router'

type Tab = 'pending' | 'active' | 'all'

const STATUS_COLOR: Record<string, string> = {
  PENDING:   COLORS.warning,
  ACTIVE:    COLORS.success,
  SUSPENDED: COLORS.danger,
}

const KYC_COLOR: Record<string, string> = {
  NOT_STARTED: COLORS.gray400,
  SUBMITTED:   '#2563EB',
  APPROVED:    COLORS.success,
  REJECTED:    COLORS.danger,
}

export default function AmbassadorsScreen() {
  const [tab, setTab] = useState<Tab>('pending')
  const [ambassadors, setAmbassadors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.ambassadors.list()
      setAmbassadors(data)
    } catch (err) {
      console.error('Failed to load ambassadors', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const onRefresh = () => { setRefreshing(true); load() }

  const filtered = ambassadors.filter((a) => {
    if (tab === 'pending') return a.status === 'PENDING'
    if (tab === 'active')  return a.status === 'ACTIVE'
    return true
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleApprove(ambassador: any) {
    const name = `${ambassador.user?.firstName || ''} ${ambassador.user?.lastName || ''}`.trim()
    Alert.alert(
      'Approve Ambassador',
      `Approve ${name} and grant them ACTIVE status with access to the Ambassador dashboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(true)
            try {
              // Approve KYC first, then activate
              await api.ambassadors.reviewKyc(ambassador.id, 'APPROVED', undefined)
              await api.ambassadors.updateStatus(ambassador.id, 'ACTIVE')
              await load()
              setSelected(null)
              Alert.alert('Done', `${name} is now an active ambassador.`)
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to approve ambassador')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ]
    )
  }

  async function handleReject(ambassador: any) {
    if (!rejectNote.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejection.')
      return
    }
    const name = `${ambassador.user?.firstName || ''} ${ambassador.user?.lastName || ''}`.trim()
    Alert.alert(
      'Reject Application',
      `Reject ${name}'s application with this note?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true)
            try {
              await api.ambassadors.reviewKyc(ambassador.id, 'REJECTED', rejectNote.trim())
              await load()
              setSelected(null)
              setRejectNote('')
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to reject application')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ]
    )
  }

  async function handleSuspend(ambassador: any) {
    const name = `${ambassador.user?.firstName || ''} ${ambassador.user?.lastName || ''}`.trim()
    Alert.alert(
      'Suspend Ambassador',
      `Suspend ${name}'s ambassador account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true)
            try {
              await api.ambassadors.updateStatus(ambassador.id, 'SUSPENDED')
              await load()
              setSelected(null)
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to suspend')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ]
    )
  }

  // ── Detail panel ───────────────────────────────────────────────────────────

  if (selected) {
    const amb = selected
    const name = `${amb.user?.firstName || ''} ${amb.user?.lastName || ''}`.trim() || 'Unknown'
    const kyc  = amb.kycData || {}
    const banking = kyc.banking || {}
    const docUrl  = kyc.idDocumentUrl || ''
    const isImage = docUrl.match(/\.(jpg|jpeg|png|webp)$/i)

    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelected(null); setRejectNote('') }} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{name}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
          {/* Status badges */}
          <View style={styles.badgeRow}>
            <Badge label={amb.status} color={STATUS_COLOR[amb.status] || COLORS.gray400} />
            <Badge label={`KYC: ${(amb.kycStatus || 'NOT_STARTED').replace('_', ' ')}`} color={KYC_COLOR[amb.kycStatus] || COLORS.gray400} />
          </View>

          {/* Personal details */}
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <Card padding={16}>
            <DetailRow label="Email"     value={amb.user?.email || '—'} />
            <DetailRow label="Phone"     value={amb.user?.phone || kyc.phone || '—'} />
            <DetailRow label="Address"   value={kyc.address || '—'} />
            <DetailRow label="Applied"   value={new Date(amb.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <DetailRow label="Code"      value={amb.code || '—'} />
            <DetailRow label="Commission" value={`${((amb.commissionRate || 0.10) * 100).toFixed(0)}%`} />
          </Card>

          {/* Identity */}
          <Text style={styles.sectionTitle}>Identity</Text>
          <Card padding={16}>
            <DetailRow label="ID Type"   value={kyc.idType || '—'} />
            <DetailRow label="ID Number" value={kyc.idNumber ? `••••••${kyc.idNumber.slice(-4)}` : '—'} />
            {amb.kycNote && <DetailRow label="Note" value={amb.kycNote} highlight />}
          </Card>

          {/* KYC Document */}
          {docUrl ? (
            <>
              <Text style={styles.sectionTitle}>ID Document</Text>
              <Card padding={16}>
                {isImage ? (
                  <TouchableOpacity onPress={() => Linking.openURL(docUrl)} activeOpacity={0.85}>
                    <Image source={{ uri: docUrl }} style={styles.docImage} resizeMode="contain" />
                    <Text style={styles.docTapHint}>Tap to open full size</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pdfBtn} onPress={() => Linking.openURL(docUrl)}>
                    <Text style={styles.pdfBtnIcon}>📄</Text>
                    <Text style={styles.pdfBtnText}>Open PDF Document</Text>
                  </TouchableOpacity>
                )}
              </Card>
            </>
          ) : null}

          {/* Banking */}
          {banking.bankName ? (
            <>
              <Text style={styles.sectionTitle}>Banking Details</Text>
              <Card padding={16}>
                <DetailRow label="Bank"           value={banking.bankName} />
                <DetailRow label="Account Holder" value={banking.accountName} />
                <DetailRow label="Account Number" value={banking.accountNumber ? `••••••${banking.accountNumber.slice(-4)}` : '—'} />
                <DetailRow label="Branch Code"    value={banking.branchCode || '—'} />
                <DetailRow label="Account Type"   value={banking.accountType || '—'} />
              </Card>
            </>
          ) : null}

          {/* Bio */}
          {amb.bio ? (
            <>
              <Text style={styles.sectionTitle}>Why They Want to Be an Ambassador</Text>
              <Card padding={16}>
                <Text style={styles.bioText}>"{amb.bio}"</Text>
              </Card>
            </>
          ) : null}

          {/* Actions */}
          <Text style={styles.sectionTitle}>Actions</Text>

          {/* Reject with note */}
          {amb.status === 'PENDING' && (
            <>
              <TextInput
                style={styles.noteInput}
                placeholder="Rejection reason (required to reject)…"
                placeholderTextColor="#bbb"
                value={rejectNote}
                onChangeText={setRejectNote}
                multiline
              />
            </>
          )}

          <View style={styles.actionRow}>
            {amb.status === 'PENDING' && (
              <>
                <TouchableOpacity
                  style={[styles.approveBtn, actionLoading && styles.btnDisabled]}
                  onPress={() => handleApprove(amb)}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>✓ Approve</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, actionLoading && styles.btnDisabled]}
                  onPress={() => handleReject(amb)}
                  disabled={actionLoading}
                >
                  <Text style={styles.rejectBtnText}>✕ Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {amb.status === 'ACTIVE' && (
              <TouchableOpacity
                style={[styles.suspendBtn, actionLoading && styles.btnDisabled]}
                onPress={() => handleSuspend(amb)}
                disabled={actionLoading}
              >
                <Text style={styles.suspendBtnText}>⚠ Suspend</Text>
              </TouchableOpacity>
            )}
            {amb.status === 'SUSPENDED' && (
              <TouchableOpacity
                style={[styles.approveBtn, actionLoading && styles.btnDisabled]}
                onPress={() => handleApprove(amb)}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>Reactivate</Text>}
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────

  const pendingCount = ambassadors.filter(a => a.status === 'PENDING').length

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ambassadors</Text>
        {pendingCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pendingCount} pending</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          ['pending', 'Pending'],
          ['active',  'Active'],
          ['all',     'All'],
        ] as const).map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
        >
          {filtered.length === 0 && (
            <Text style={styles.empty}>No ambassadors in this category</Text>
          )}
          {filtered.map((amb) => {
            const name = `${amb.user?.firstName || ''} ${amb.user?.lastName || ''}`.trim() || 'Unknown'
            const totalEarned = (amb.commissions || []).reduce((s: number, c: any) => s + Number(c.amount), 0)
            const kycLabel = (amb.kycStatus || 'NOT_STARTED').replace('_', ' ')
            return (
              <TouchableOpacity key={amb.id} onPress={() => { setSelected(amb); setRejectNote('') }} activeOpacity={0.85}>
                <Card padding={16} style={styles.ambCard}>
                  <View style={styles.ambRow}>
                    <View style={[styles.avatar, { backgroundColor: STATUS_COLOR[amb.status] || COLORS.gray400 }]}>
                      <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.ambInfo}>
                      <Text style={styles.ambName}>{name}</Text>
                      <Text style={styles.ambEmail}>{amb.user?.email || '—'}</Text>
                      <Text style={styles.ambCode}>Code: {amb.code}</Text>
                    </View>
                    <View style={styles.ambRight}>
                      <Badge label={amb.status} color={STATUS_COLOR[amb.status] || COLORS.gray400} />
                      <Text style={styles.kycLabel}>KYC: {kycLabel}</Text>
                      <Text style={styles.earned}>R{totalEarned.toFixed(2)}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            )
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailHighlight]} numberOfLines={3}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: COLORS.gray50 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  title:     { fontSize: 22, fontWeight: '900', color: COLORS.gray900, flex: 1 },
  backBtn:   { padding: 8, marginRight: 4 },
  backIcon:  { fontSize: 22, color: COLORS.gray900 },
  countBadge: { backgroundColor: COLORS.warning, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  tabRow:     { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab:        { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.gray100, alignItems: 'center' },
  tabActive:  { backgroundColor: BRAND },
  tabText:    { fontSize: 13, fontWeight: '700', color: COLORS.gray500 },
  tabTextActive: { color: '#fff' },

  listScroll:  { padding: 16, gap: 10 },
  empty:       { textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 },

  ambCard:   { marginBottom: 0 },
  ambRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:{ color: '#fff', fontWeight: '900', fontSize: 16 },
  ambInfo:   { flex: 1 },
  ambName:   { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  ambEmail:  { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  ambCode:   { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  ambRight:  { alignItems: 'flex-end', gap: 4 },
  kycLabel:  { fontSize: 11, color: COLORS.gray500, marginTop: 4 },
  earned:    { fontSize: 13, fontWeight: '700', color: COLORS.gray700 },

  // Detail view
  badgeRow:   { flexDirection: 'row', gap: 8, marginBottom: 16 },
  detailScroll: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.gray700, marginTop: 20, marginBottom: 8 },
  detailRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  detailLabel:{ fontSize: 13, color: COLORS.gray500 },
  detailValue:{ fontSize: 13, fontWeight: '600', color: COLORS.gray900, flex: 1, textAlign: 'right', marginLeft: 12 },
  detailHighlight: { color: COLORS.danger },

  docImage:   { width: '100%', height: 220, borderRadius: 10 },
  docTapHint: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', marginTop: 6 },
  pdfBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: COLORS.gray50, borderRadius: 10 },
  pdfBtnIcon: { fontSize: 28 },
  pdfBtnText: { fontSize: 14, fontWeight: '700', color: BRAND },

  bioText:    { fontSize: 14, color: COLORS.gray700, lineHeight: 22, fontStyle: 'italic' },

  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    padding: 14,
    fontSize: 14,
    color: COLORS.gray900,
    minHeight: 80,
    marginBottom: 12,
    textAlignVertical: 'top',
  },

  actionRow:  { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 1, backgroundColor: COLORS.success, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  rejectBtn:  { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.danger },
  rejectBtnText: { color: COLORS.danger, fontWeight: '800', fontSize: 15 },
  suspendBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.warning },
  suspendBtnText: { color: COLORS.warning, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
})
