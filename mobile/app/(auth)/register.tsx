import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../../context/AuthContext'

export default function RegisterScreen() {
  const { register, applyAuth } = useAuth()
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' })
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [countdown, setCountdown] = useState(3)
  const pendingAuth = useRef<{ token: string; user: any } | null>(null)

  // Once success is shown, count down then apply auth (triggers routing)
  useEffect(() => {
    if (!success) return
    if (countdown <= 0) {
      if (pendingAuth.current) applyAuth(pendingAuth.current.token, pendingAuth.current.user)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [success, countdown])

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      return Alert.alert('Error', 'Please fill in all required fields')
    }
    setLoading(true)
    try {
      const result = await register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
      })
      pendingAuth.current = result
      setSuccess(true)
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Account Created!</Text>
          <Text style={styles.successName}>Welcome, {form.firstName}!</Text>
          <Text style={styles.successSub}>
            Your account is ready.{'\n'}Taking you home in {countdown}…
          </Text>
          <View style={styles.successDots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, countdown <= i && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => {
              if (pendingAuth.current) applyAuth(pendingAuth.current.token, pendingAuth.current.user)
            }}
          >
            <Text style={styles.continueBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the Tlaka Treats family</Text>

        {(['firstName', 'lastName', 'email', 'phone', 'password'] as const).map((field) => (
          <TextInput
            key={field}
            style={styles.input}
            placeholder={field === 'firstName' ? 'First Name *' : field === 'lastName' ? 'Last Name *' : field === 'email' ? 'Email *' : field === 'phone' ? 'Phone' : 'Password *'}
            placeholderTextColor="#999"
            secureTextEntry={field === 'password'}
            keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'}
            autoCapitalize={field === 'email' || field === 'password' ? 'none' : 'words'}
            value={form[field]}
            onChangeText={(v) => setForm(prev => ({ ...prev, [field]: v }))}
          />
        ))}

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const { router } = require('expo-router')
            router.back()
          }}
          style={styles.loginRow}
        >
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#8B3A3A' },
  inner:      { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle:   { fontSize: 16, color: '#f5d0d0', marginBottom: 32 },
  input:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 14, color: '#1a1a1a' },
  button:     { backgroundColor: '#5C1A1A', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20, marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginRow:   { alignItems: 'center' },
  loginText:  { color: '#f5d0d0', fontSize: 14 },
  loginLink:  { fontWeight: '700', color: '#fff' },

  // Success screen
  successContainer: {
    flex: 1,
    backgroundColor: '#8B3A3A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#1a1a1a', marginBottom: 6 },
  successName:  { fontSize: 18, fontWeight: '700', color: '#8B3A3A', marginBottom: 12 },
  successSub:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successDots:  { flexDirection: 'row', gap: 8, marginBottom: 28 },
  dot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e8d5d5' },
  dotActive:    { backgroundColor: '#8B3A3A' },
  continueBtn:  { backgroundColor: '#8B3A3A', borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14 },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
