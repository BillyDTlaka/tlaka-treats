import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BRAND } from '../../lib/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert('Login Failed', e?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🍪</Text>
          </View>
          <Text style={styles.title}>Tlaka Treats</Text>
          <Text style={styles.subtitle}>Fresh treats delivered to your door</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.gray400}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={COLORS.gray400}
            secureTextEntry
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.registerRow}>
            <Text style={styles.registerText}>
              New here? <Text style={styles.registerLink}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.white },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 28 },
  header:       { alignItems: 'center', marginBottom: 40 },
  logo:         { width: 80, height: 80, borderRadius: 24, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText:     { fontSize: 36 },
  title:        { fontSize: 26, fontWeight: '900', color: COLORS.gray900, marginBottom: 6 },
  subtitle:     { fontSize: 14, color: COLORS.gray500, textAlign: 'center' },
  form:         { gap: 8 },
  label:        { fontSize: 12, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 8 },
  input:        { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.gray900, backgroundColor: COLORS.gray50 },
  btn:          { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled:  { opacity: 0.7 },
  btnText:      { color: '#fff', fontSize: 16, fontWeight: '800' },
  registerRow:  { alignItems: 'center', marginTop: 16 },
  registerText: { fontSize: 14, color: COLORS.gray500 },
  registerLink: { color: BRAND, fontWeight: '700' },
});
