import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/auth.store'
import { useAuth } from '../../context/AuthContext'
import { ambassadorsApi } from '../../services/api'
import AmbassadorTabBar from '../../components/AmbassadorTabBar'

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: '⏳ Pending Review' },
  ACTIVE:    { bg: '#D4EDDA', text: '#155724', label: '✅ Active' },
  SUSPENDED: { bg: '#F8D7DA', text: '#721C24', label: '⛔ Suspended' },
}

export default function AmbassadorProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [ambassador, setAmbassador] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ambassadorsApi.me().then(setAmbassador).finally(() => setLoading(false))
  }, [])

  const shareCode = async () => {
    if (!ambassador?.code) return
    try {
      await Share.share({
        message: `Order fresh treats from Tlaka Treats using my referral code: ${ambassador.code} 🍪\nTasty biscuits, scones & more delivered to your door!`,
      })
    } catch {
      // user dismissed
    }
  }

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ])
  }

  const statusInfo = ambassador
    ? (STATUS_CONFIG[ambassador.status] ?? { bg: '#eee', text: '#666', label: ambassador.status })
    : null

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/(ambassador)/settings')}
        >
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#8B3A3A" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {statusInfo && (
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
                  {statusInfo.label}
                </Text>
              </View>
            )}
          </View>

          {/* Referral Code Card */}
          {ambassador?.code && (
            <View style={styles.codeCard}>
              <Text style={styles.codeCardLabel}>Your Referral Code</Text>
              <Text style={styles.code}>{ambassador.code}</Text>
              <Text style={styles.codeHint}>
                Share this with customers — you earn commission on every order placed with your code
              </Text>
              <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
                <Text style={styles.shareBtnText}>📤  Share My Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Commission Info */}
          {ambassador && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Commission Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Commission Rate</Text>
                <Text style={styles.infoValueAccent}>
                  {(Number(ambassador.commissionRate) * 100).toFixed(0)}%
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Status</Text>
                <View style={[styles.inlineBadge, { backgroundColor: statusInfo?.bg }]}>
                  <Text style={[styles.inlineBadgeText, { color: statusInfo?.text }]}>
                    {ambassador.status}
                  </Text>
                </View>
              </View>
              {ambassador.bio && (
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Bio</Text>
                  <Text style={[styles.infoValue, { flex: 1, textAlign: 'right', flexWrap: 'wrap' }]}>
                    {ambassador.bio}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Account Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>First Name</Text>
              <Text style={styles.infoValue}>{user?.firstName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Name</Text>
              <Text style={styles.infoValue}>{user?.lastName}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          {/* Suspended notice */}
          {ambassador?.status === 'SUSPENDED' && (
            <View style={styles.suspendedNotice}>
              <Text style={styles.suspendedIcon}>⚠️</Text>
              <Text style={styles.suspendedText}>
                Your ambassador account has been suspended. Please contact support for more information.
              </Text>
            </View>
          )}

          {/* Settings */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => router.push('/(ambassador)/settings')}
          >
            <Text style={styles.settingsRowIcon}>⚙️</Text>
            <Text style={styles.settingsRowLabel}>Settings</Text>
            <Text style={styles.settingsRowChevron}>›</Text>
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <AmbassadorTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#8B3A3A',
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  settingsBtn: { padding: 4 },
  settingsBtnText: { fontSize: 24 },
  settingsRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0e8e8',
  },
  settingsRowIcon: { fontSize: 20, marginRight: 12 },
  settingsRowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  settingsRowChevron: { fontSize: 22, color: '#ccc' },
  scrollContent: { padding: 16 },
  avatarSection: { alignItems: 'center', marginVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B3A3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 14, color: '#999', marginBottom: 10 },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },
  codeCard: {
    backgroundColor: '#8B3A3A',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#8B3A3A',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  codeCardLabel: { color: '#f5d0d0', fontSize: 13, marginBottom: 8 },
  code: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  codeHint: { color: '#f5d0d0', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  shareBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  shareBtnText: { color: '#8B3A3A', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 14 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5eded',
  },
  infoLabel: { fontSize: 14, color: '#999' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  infoValueAccent: { fontSize: 16, fontWeight: '800', color: '#8B3A3A' },
  inlineBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  inlineBadgeText: { fontSize: 12, fontWeight: '700' },
  suspendedNotice: {
    backgroundColor: '#FFF0E6',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5d0d0',
  },
  suspendedIcon: { fontSize: 20 },
  suspendedText: { flex: 1, fontSize: 13, color: '#8B3A3A', lineHeight: 18 },
  logoutBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5d0d0',
    marginBottom: 16,
  },
  logoutText: { color: '#8B3A3A', fontWeight: '700', fontSize: 15 },
})
