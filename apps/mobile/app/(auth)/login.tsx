import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { Colors, Typography, Radius } from '../../src/lib/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <Text style={styles.logo}>Folio<Text style={styles.dot}>.</Text></Text>
          <Text style={styles.tagline}>Your reading life, finally organized.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="current-password"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={signIn} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Sign in</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.link}>
            <Text style={styles.linkText}>No account? <Text style={styles.linkBold}>Create one free</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.forest },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logo: { fontFamily: Typography.serif, fontSize: 40, color: Colors.white },
  dot: { color: Colors.terra },
  tagline: { fontFamily: Typography.sans, color: `${Colors.cream}99`, fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius['2xl'],
    padding: 28,
  },
  title: { fontFamily: Typography.serif, fontSize: 24, color: Colors.forest, marginBottom: 16 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 13, fontFamily: Typography.sans },
  field: { marginBottom: 14 },
  label: { fontFamily: Typography.sansSb, fontSize: 11, color: Colors.forest, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 14,
    fontFamily: Typography.sans, fontSize: 15, color: Colors.text,
    backgroundColor: Colors.white,
  },
  btn: {
    backgroundColor: Colors.terra, borderRadius: Radius.full,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { fontFamily: Typography.sansSb, fontSize: 16, color: Colors.white },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { fontFamily: Typography.sans, fontSize: 14, color: Colors.textMuted },
  linkBold: { fontFamily: Typography.sansSb, color: Colors.forest },
})
