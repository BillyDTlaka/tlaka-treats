import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ambassadorsApi } from '../../services/api'

const ID_TYPES = ['SA ID', 'Passport', "Driver's Licence"]
const BANKS = ['ABSA', 'Capitec', 'FNB', 'Nedbank', 'Standard Bank', 'TymeBank', 'Discovery Bank', 'African Bank', 'Other']
const ACCOUNT_TYPES = ['Cheque / Current', 'Savings', 'Transmission']

export default function AmbassadorApply() {
  const insets = useSafeAreaInsets()

  // About you
  const [bio, setBio] = useState('')

  // Contact
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Identity
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [idDocumentUrl, setIdDocumentUrl] = useState('')

  // Banking
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [accountType, setAccountType] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!bio.trim()) return Alert.alert('Required', 'Please tell us why you want to be an ambassador')
    if (!phone.trim()) return Alert.alert('Required', 'Please enter your contact number')
    if (!address.trim()) return Alert.alert('Required', 'Please enter your physical address')
    if (!idType) return Alert.alert('Required', 'Please select your ID type')
    if (!idNumber.trim()) return Alert.alert('Required', 'Please enter your ID number')
    if (!idDocumentUrl.trim()) return Alert.alert('Required', 'Please provide a link to your ID document')
    if (!bankName) return Alert.alert('Required', 'Please select your bank')
    if (!accountName.trim()) return Alert.alert('Required', 'Please enter the account holder name')
    if (!accountNumber.trim()) return Alert.alert('Required', 'Please enter your account number')
    if (!branchCode.trim()) return Alert.alert('Required', 'Please enter your branch code')
    if (!accountType) return Alert.alert('Required', 'Please select your account type')

    setSubmitting(true)
    try {
      await ambassadorsApi.apply({
        bio: bio.trim(),
        phone: phone.trim(),
        address: address.trim(),
        idType,
        idNumber: idNumber.trim(),
        idDocumentUrl: idDocumentUrl.trim(),
        bankName,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        branchCode: branchCode.trim(),
        accountType,
      })
      router.replace('/(customer)/ambassador-status' as any)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.'
      Alert.alert('Application Failed', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ambassador Application</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.introBanner}>
          <Text style={styles.introEmoji}>🌟</Text>
          <Text style={styles.introTitle}>Become a Tlaka Treats Ambassador</Text>
          <Text style={styles.introText}>
            Earn commission on every order placed with your unique code. Fill in the details below and our team will review your application.
          </Text>
        </View>

        {/* ── About You ───────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>About You</Text>
        <Text style={styles.fieldLabel}>Why do you want to be an ambassador? *</Text>
        <TextInput
          style={[styles.textInput, { height: 100 }]}
          placeholder="Tell us about yourself and why you'd make a great ambassador for Tlaka Treats…"
          placeholderTextColor="#bbb"
          value={bio}
          onChangeText={setBio}
          multiline
          textAlignVertical="top"
        />

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Contact Details</Text>
        <Text style={styles.fieldLabel}>Mobile number *</Text>
        <TextInput style={styles.textInput} placeholder="e.g. 071 234 5678" placeholderTextColor="#bbb" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.fieldLabel}>Physical address *</Text>
        <TextInput
          style={[styles.textInput, { height: 80 }]}
          placeholder="e.g. 12 Rose Street, Soweto, 1804"
          placeholderTextColor="#bbb"
          value={address}
          onChangeText={setAddress}
          multiline
          textAlignVertical="top"
        />

        {/* ── Identity ────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Identity Verification</Text>
        <Text style={styles.fieldLabel}>ID document type *</Text>
        <View style={styles.chipRow}>
          {ID_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, idType === t && styles.chipActive]}
              onPress={() => setIdType(t)}
            >
              <Text style={[styles.chipText, idType === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>ID / Passport number *</Text>
        <TextInput style={styles.textInput} placeholder="e.g. 9001015009087" placeholderTextColor="#bbb" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" />

        <Text style={styles.fieldLabel}>Link to your ID document *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Upload to Google Drive / Dropbox and paste the share link here"
          placeholderTextColor="#bbb"
          value={idDocumentUrl}
          onChangeText={setIdDocumentUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={styles.hint}>
          Upload a clear photo or scan of your ID to Google Drive, Dropbox, or similar and paste the shareable link above.
        </Text>

        {/* ── Banking Details ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Banking Details</Text>
        <Text style={styles.sectionNote}>Your commission payments will be sent to this account.</Text>

        <Text style={styles.fieldLabel}>Bank *</Text>
        <View style={styles.chipRow}>
          {BANKS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.chip, bankName === b && styles.chipActive]}
              onPress={() => setBankName(b)}
            >
              <Text style={[styles.chipText, bankName === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Account holder name *</Text>
        <TextInput style={styles.textInput} placeholder="Full name as it appears on your bank account" placeholderTextColor="#bbb" value={accountName} onChangeText={setAccountName} autoCapitalize="words" />

        <Text style={styles.fieldLabel}>Account number *</Text>
        <TextInput style={styles.textInput} placeholder="e.g. 1234567890" placeholderTextColor="#bbb" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>Branch code *</Text>
        <TextInput style={styles.textInput} placeholder="e.g. 051001" placeholderTextColor="#bbb" value={branchCode} onChangeText={setBranchCode} keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>Account type *</Text>
        <View style={styles.chipRow}>
          {ACCOUNT_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, accountType === t && styles.chipActive]}
              onPress={() => setAccountType(t)}
            >
              <Text style={[styles.chipText, accountType === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.declarationBox}>
          <Text style={styles.declarationText}>
            By submitting this application I confirm that all information provided is accurate and I agree to the Tlaka Treats Ambassador Terms & Conditions.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit Application</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  header: { backgroundColor: '#8B3A3A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scrollContent: { padding: 20 },

  introBanner: { backgroundColor: '#8B3A3A', borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 24 },
  introEmoji: { fontSize: 36, marginBottom: 10 },
  introTitle: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  introText: { fontSize: 13, color: '#f5d0d0', textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginTop: 24, marginBottom: 4 },
  sectionNote: { fontSize: 12, color: '#999', marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 18 },

  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8d5d5',
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 4,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e8d5d5' },
  chipActive: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#8B3A3A' },
  chipTextActive: { color: '#fff' },

  declarationBox: { backgroundColor: '#FFF8F0', borderRadius: 12, padding: 16, marginTop: 24, marginBottom: 20, borderWidth: 1, borderColor: '#f5d0d0' },
  declarationText: { fontSize: 12, color: '#666', lineHeight: 18, textAlign: 'center' },

  submitBtn: { backgroundColor: '#8B3A3A', borderRadius: 14, padding: 18, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
