import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator
} from 'react-native'
import { router } from 'expo-router'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

export default function RegisterScreen() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      return Alert.alert('Error', 'Please fill in all required fields')
    }
    setLoading(true)
    try {
      const { token, user } = await authApi.register(form)
      await setAuth(token, user)
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the Tlaka Treats family</Text>

        {(['firstName', 'lastName', 'email', 'phone', 'password'] as const).map((field) => (
          <TextInput
            key={field}
            style={styles.input}
            placeholder={field === 'firstName' ? 'First Name' : field === 'lastName' ? 'Last Name' : field.charAt(0).toUpperCase() + field.slice(1)}
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

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#8B3A3A' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#f5d0d0', marginBottom: 32 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 14, color: '#1a1a1a' },
  button: { backgroundColor: '#5C1A1A', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20, marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: '#f5d0d0', fontSize: 14 },
  linkBold: { fontWeight: '700', color: '#fff' },
})
