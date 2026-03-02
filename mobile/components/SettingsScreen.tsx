import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { useAuthStore } from '../store/auth.store'

const PREFS_KEY = 'tlaka_notification_prefs'

interface NotifPrefs {
  orderUpdates: boolean
  readyForPickup: boolean
  promotions: boolean
  ambassadorEarnings: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  orderUpdates: true,
  readyForPickup: true,
  promotions: false,
  ambassadorEarnings: true,
}

interface SettingsRowProps {
  icon: string
  label: string
  sublabel?: string
  onPress?: () => void
  right?: React.ReactNode
  danger?: boolean
  disabled?: boolean
}

function SettingsRow({ icon, label, sublabel, onPress, right, danger, disabled }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={styles.rowChevron}>›</Text> : null)}
    </TouchableOpacity>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function Divider() {
  return <View style={styles.divider} />
}

interface Props {
  role: 'customer' | 'ambassador'
}

export default function SettingsScreen({ role }: Props) {
  const insets = useSafeAreaInsets()
  const { user, logout } = useAuthStore()
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)

  const appVersion = Constants.expoConfig?.version ?? '1.0.0'

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) {
        try {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })
        } catch {
          // ignore malformed data
        }
      }
    })
  }, [])

  const updatePref = async (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next))
  }

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open link', 'Please try again later.')
    )
  }

  const contactWhatsApp = () => {
    // Opens WhatsApp with a pre-filled message to the business number
    const number = '27000000000' // TODO: replace with real support number
    const message = encodeURIComponent(`Hi Tlaka Treats! I need some help with my account (${user?.email}).`)
    openLink(`whatsapp://send?phone=${number}&text=${message}`)
  }

  const contactEmail = () => {
    const subject = encodeURIComponent('Support Request – Tlaka Treats App')
    const body = encodeURIComponent(
      `Hi Tlaka Treats team,\n\nI need help with:\n\n\n---\nAccount: ${user?.email}\nRole: ${role}`
    )
    openLink(`mailto:support@tlakatreats.co.za?subject=${subject}&body=${body}`)
  }

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Notifications ────────────────────── */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsRow
            icon="📦"
            label="Order Updates"
            sublabel="Confirmations, status changes"
            right={
              <Switch
                value={prefs.orderUpdates}
                onValueChange={(v) => updatePref('orderUpdates', v)}
                trackColor={{ true: '#8B3A3A', false: '#e0d4d4' }}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          <SettingsRow
            icon="🔔"
            label="Ready for Pickup"
            sublabel="When your order is ready"
            right={
              <Switch
                value={prefs.readyForPickup}
                onValueChange={(v) => updatePref('readyForPickup', v)}
                trackColor={{ true: '#8B3A3A', false: '#e0d4d4' }}
                thumbColor="#fff"
              />
            }
          />
          <Divider />
          {role === 'ambassador' && (
            <>
              <SettingsRow
                icon="💰"
                label="Ambassador Earnings"
                sublabel="When you earn commission"
                right={
                  <Switch
                    value={prefs.ambassadorEarnings}
                    onValueChange={(v) => updatePref('ambassadorEarnings', v)}
                    trackColor={{ true: '#8B3A3A', false: '#e0d4d4' }}
                    thumbColor="#fff"
                  />
                }
              />
              <Divider />
            </>
          )}
          <SettingsRow
            icon="🎉"
            label="Promotions & Deals"
            sublabel="Special offers and news"
            right={
              <Switch
                value={prefs.promotions}
                onValueChange={(v) => updatePref('promotions', v)}
                trackColor={{ true: '#8B3A3A', false: '#e0d4d4' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* ── Reports & Analytics ──────────────── */}
        <SectionHeader title="Reports & Analytics" />
        <View style={styles.card}>
          <SettingsRow
            icon="📊"
            label="View Reports"
            sublabel={role === 'ambassador' ? 'Commission, attributed orders & earnings' : 'Spending, orders & top products'}
            onPress={() => router.push(role === 'ambassador' ? '/(ambassador)/reports' : '/(customer)/reports')}
          />
        </View>

        {/* ── Account ──────────────────────────── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingsRow
            icon="👤"
            label="Edit Profile"
            sublabel="Update your name and phone number"
            onPress={() =>
              Alert.alert('Coming Soon', 'Profile editing will be available in the next update.')
            }
          />
          <Divider />
          <SettingsRow
            icon="🔑"
            label="Change Password"
            sublabel="Update your account password"
            onPress={() =>
              Alert.alert('Coming Soon', 'Password changes will be available in the next update.')
            }
          />
        </View>

        {/* ── Support ──────────────────────────── */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingsRow
            icon="💬"
            label="Chat on WhatsApp"
            sublabel="Quick support from our team"
            onPress={contactWhatsApp}
          />
          <Divider />
          <SettingsRow
            icon="✉️"
            label="Email Support"
            sublabel="support@tlakatreats.co.za"
            onPress={contactEmail}
          />
          <Divider />
          <SettingsRow
            icon="⭐"
            label="Rate the App"
            sublabel="Tell us what you think"
            onPress={() =>
              Alert.alert('Thanks for your support!', 'App store rating will be available when the app is published.')
            }
          />
        </View>

        {/* ── About ────────────────────────────── */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow
            icon="📋"
            label="Terms of Service"
            onPress={() => openLink('https://tlakatreats.co.za/terms')}
          />
          <Divider />
          <SettingsRow
            icon="🔒"
            label="Privacy Policy"
            onPress={() => openLink('https://tlakatreats.co.za/privacy')}
          />
          <Divider />
          <SettingsRow
            icon="🍪"
            label="Tlaka Treats"
            sublabel={`Version ${appVersion}`}
            disabled
          />
        </View>

        {/* ── Sign out ─────────────────────────── */}
        <View style={[styles.card, styles.dangerCard]}>
          <SettingsRow
            icon="🚪"
            label="Log Out"
            onPress={handleLogout}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },

  header: {
    backgroundColor: '#8B3A3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { padding: 8, marginRight: 4 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },

  scrollContent: { paddingVertical: 12, paddingHorizontal: 16 },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  dangerCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fde8e8',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  rowDisabled: { opacity: 0.6 },

  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowIconDanger: { backgroundColor: '#fff0f0' },
  rowIconText: { fontSize: 18 },

  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rowLabelDanger: { color: '#C0392B' },
  rowSublabel: { fontSize: 12, color: '#aaa', marginTop: 2 },

  rowChevron: { fontSize: 22, color: '#ccc', lineHeight: 26 },

  divider: {
    height: 1,
    backgroundColor: '#f7efef',
    marginLeft: 66,
  },
})
