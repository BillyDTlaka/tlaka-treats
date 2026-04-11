import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/auth.store'
import { useAuth } from '../../context/AuthContext'
import { ambassadorsApi } from '../../services/api'
import CustomerTabBar from '../../components/CustomerTabBar'

export default function CustomerProfileScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [bio, setBio] = useState('')
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    setApplying(true)
    try {
      await ambassadorsApi.apply(bio.trim() || undefined)
      setShowApplyForm(false)
      Alert.alert(
        'Application Submitted! 🎉',
        "We've received your ambassador application. We'll review it and get back to you soon.",
        [{ text: 'Got it' }]
      )
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong'
      Alert.alert('Application Failed', msg)
    } finally {
      setApplying(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/(customer)/settings')}
        >
          <Text style={styles.settingsBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>

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
        </View>

        {/* Account Info */}
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
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Customer</Text>
            </View>
          </View>
        </View>

        {/* Become Ambassador */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Earn with Tlaka Treats</Text>
          <Text style={styles.ambassadorDesc}>
            Become an ambassador and earn commission every time someone orders using your unique referral code. 🍪
          </Text>

          {!showApplyForm ? (
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => setShowApplyForm(true)}
            >
              <Text style={styles.applyBtnText}>Apply to Become an Ambassador</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.applyForm}>
              <Text style={styles.applyFormLabel}>Tell us about yourself (optional)</Text>
              <TextInput
                style={styles.bioInput}
                placeholder="Why do you want to be an ambassador? What makes you a great fit?"
                placeholderTextColor="#bbb"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
              />
              <View style={styles.applyFormActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowApplyForm(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, applying && { opacity: 0.6 }]}
                  onPress={handleApply}
                  disabled={applying}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Application</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Settings */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => router.push('/(customer)/settings')}
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

      <CustomerTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
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
  email: { fontSize: 14, color: '#999' },
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
  roleBadge: { backgroundColor: '#FFF0E6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: '#8B3A3A' },
  ambassadorDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  applyBtn: {
    backgroundColor: '#8B3A3A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  applyForm: { gap: 12 },
  applyFormLabel: { fontSize: 14, color: '#555', fontWeight: '600' },
  bioInput: {
    backgroundColor: '#FDF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8d5d5',
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  applyFormActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8d5d5',
  },
  cancelBtnText: { color: '#999', fontWeight: '600', fontSize: 14 },
  submitBtn: {
    flex: 2,
    backgroundColor: '#8B3A3A',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
