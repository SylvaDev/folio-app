import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { Colors, Typography, Radius } from '../../src/lib/theme'

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function signUp() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  if (done) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <Text style={[styles.logo, { marginBottom: 16 }]}>Folio<Text style={styles.dot}>.</Text></Text>
        <Text style={[styles.title, { color: Colors.white, textAlign: 'center' }]}>Check your inbox</Text>
        <Text style={{ color: `${Colors.cream}99`, textAlign: 'center', marginTop: 12, fontFamily: Typography.sans, fontSize: 15, lineHeight: 22 }}>
          We sent a confirmation email. Click the link to activate your account.
        </Text>
        <TouchableOpacity style={[styles.btn, { marginTop: 32, width: '100%' }]} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.btnText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Text style={styles.logo}>Folio<Text style={styles.dot}>.</Text></Text>
          <Text style={styles.tagline}>Free forever · No credit card</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create your account</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Sarah Chen" autoCapitalize="words" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password (8+ chars)</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry placeholderTextColor={Colors.textMuted} />
          </View>

          <TouchableOpacity style={styles.btn} onPress={signUp} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnText}>Create free account →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
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
  card: { backgroundColor: Colors.white, borderRadius: Radius['2xl'], padding: 28 },
  title: { fontFamily: Typography.serif, fontSize: 24, color: Colors.forest, marginBottom: 16 },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  errorText: { color: '#EF4444', fontSize: 13, fontFamily: Typography.sans },
  field: { marginBottom: 14 },
  label: { fontFamily: Typography.sansSb, fontSize: 11, color: Colors.forest, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 14, fontFamily: Typography.sans, fontSize: 15, color: Colors.text },
  btn: { backgroundColor: Colors.terra, borderRadius: Radius.full, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { fontFamily: Typography.sansSb, fontSize: 16, color: Colors.white },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { fontFamily: Typography.sans, fontSize: 14, color: Colors.textMuted },
  linkBold: { fontFamily: Typography.sansSb, color: Colors.forest },
})
