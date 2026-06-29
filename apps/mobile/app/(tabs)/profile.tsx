import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { LogOut, Upload, Settings, Star, BookMarked } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/useAuthStore'
import { Colors, Typography, Radius, Shadow } from '../../src/lib/theme'

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuthStore()

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Reader'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  const MENU = [
    { icon: Upload, label: 'Import from Goodreads', sub: 'Bring your reading history over', onPress: () => {} },
    { icon: BookMarked, label: 'Reading goal', sub: `${profile?.reading_goal ?? 'Not set'} books this year`, onPress: () => {} },
    { icon: Star, label: 'Upgrade to Pro', sub: 'Unlock AI queue & full analytics', onPress: () => {}, highlight: true },
    { icon: Settings, label: 'Settings', sub: 'Account & preferences', onPress: () => {} },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={[styles.badge, profile?.subscription !== 'free' && styles.badgePro]}>
          <Text style={styles.badgeText}>
            {profile?.subscription === 'free' ? 'Free plan' : `${profile?.subscription} ✦`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {MENU.map(({ icon: Icon, label, sub, onPress, highlight }) => (
          <TouchableOpacity key={label} onPress={onPress} style={[styles.menuItem, highlight && styles.menuHighlight]}>
            <Icon color={highlight ? Colors.terra : Colors.forest} size={20} />
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, highlight && { color: Colors.terra }]}>{label}</Text>
              <Text style={styles.menuSub}>{sub}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={confirmSignOut} style={[styles.menuItem, styles.signOutItem]}>
          <LogOut color="#EF4444" size={20} />
          <View style={styles.menuText}>
            <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Sign out</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.version}>Folio by Exovara Labs · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.forest, alignItems: 'center', padding: 24, paddingBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${Colors.mint}33`, justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontFamily: Typography.serif, fontSize: 24, color: Colors.mint },
  name: { fontFamily: Typography.serif, fontSize: 22, color: Colors.white, marginBottom: 2 },
  email: { fontFamily: Typography.sans, fontSize: 13, color: `${Colors.cream}80` },
  badge: {
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: Radius.full, backgroundColor: `${Colors.white}20`,
  },
  badgePro: { backgroundColor: `${Colors.gold}33` },
  badgeText: { fontFamily: Typography.sansMd, fontSize: 12, color: Colors.cream, textTransform: 'capitalize' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 16, ...Shadow.card,
  },
  menuHighlight: { borderWidth: 1.5, borderColor: `${Colors.terra}30`, backgroundColor: `${Colors.terra}06` },
  menuText: { flex: 1 },
  menuLabel: { fontFamily: Typography.sansSb, fontSize: 15, color: Colors.forest },
  menuSub: { fontFamily: Typography.sans, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  signOutItem: { marginTop: 8 },
  version: { fontFamily: Typography.sans, fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 16 },
})
