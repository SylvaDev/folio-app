import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Sparkles, ChevronUp, ChevronDown } from 'lucide-react-native'
import type { UserBook } from '@folio/shared'
import { scoreTBRQueue } from '@folio/shared'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/store/useAuthStore'
import { Colors, Typography, Radius, Shadow } from '../../src/lib/theme'

const MOODS = [
  { key: 'calm', label: 'Calm', emoji: '🌿' },
  { key: 'adventurous', label: 'Adventure', emoji: '⚔️' },
  { key: 'dark', label: 'Dark', emoji: '🌑' },
  { key: 'funny', label: 'Funny', emoji: '😂' },
  { key: 'romantic', label: 'Romance', emoji: '💌' },
]

export default function TBRScreen() {
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const [books, setBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [aiRec, setAiRec] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_books')
      .select('*, book:books(*)')
      .eq('user_id', user.id)
      .eq('status', 'tbr')
      .order('priority', { ascending: false })
      .then(({ data }) => {
        setBooks((data as UserBook[]) ?? [])
        setLoading(false)
      })
  }, [user])

  const scored = scoreTBRQueue(books, selectedMood ?? undefined)
  const sortedBooks = [...books].sort((a, b) => {
    const sa = scored.find(s => s.userBookId === a.id)?.score ?? 0
    const sb = scored.find(s => s.userBookId === b.id)?.score ?? 0
    return sb - sa
  })

  async function adjustPriority(id: string, delta: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const book = books.find(b => b.id === id)
    if (!book) return
    const newPriority = Math.max(1, Math.min(5, book.priority + delta))
    await supabase.from('user_books').update({ priority: newPriority }).eq('id', id)
    setBooks(prev => prev.map(b => b.id === id ? { ...b, priority: newPriority } : b))
  }

  async function startReading(id: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    await supabase.from('user_books').update({
      status: 'reading',
      date_started: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    setBooks(prev => prev.filter(b => b.id !== id))
  }

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator color={Colors.mint} size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TBR Queue</Text>
        <Text style={styles.headerSub}>{books.length} books waiting</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Mood picker */}
        <View style={styles.moodCard}>
          <Text style={styles.moodTitle}>What's your reading mood?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.moods}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setSelectedMood(selectedMood === m.key ? null : m.key)}
                  style={[styles.moodChip, selectedMood === m.key && styles.moodChipActive]}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, selectedMood === m.key && styles.moodLabelActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* AI Rec */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Sparkles color={Colors.mint} size={16} />
            <Text style={styles.aiTitle}>AI Recommendation</Text>
            {profile?.subscription === 'free' && (
              <View style={styles.proBadge}><Text style={styles.proBadgeText}>Pro</Text></View>
            )}
          </View>
          {aiRec ? (
            <Text style={styles.aiRec}>{aiRec}</Text>
          ) : (
            <Text style={styles.aiHint}>
              {profile?.subscription !== 'free'
                ? 'AI will suggest your next read based on your mood and TBR.'
                : 'Upgrade to Pro for AI-powered reading recommendations.'}
            </Text>
          )}
        </View>

        {/* Queue */}
        <Text style={styles.sectionTitle}>Your Queue</Text>
        {sortedBooks.map((ub, idx) => {
          const book = ub.book as any
          if (!book) return null
          return (
            <View key={ub.id} style={styles.queueRow}>
              <Text style={styles.rank}>#{idx + 1}</Text>
              {book.cover_url ? (
                <Image source={{ uri: book.cover_url }} style={styles.queueCover} contentFit="cover" />
              ) : (
                <View style={[styles.queueCover, styles.coverPlaceholder]}>
                  <Text style={styles.coverText} numberOfLines={2}>{book.title}</Text>
                </View>
              )}
              <View style={styles.queueInfo}>
                <Text style={styles.queueTitle} numberOfLines={1}>{book.title}</Text>
                <Text style={styles.queueAuthor} numberOfLines={1}>{book.authors?.[0]}</Text>
                <TouchableOpacity onPress={() => startReading(ub.id)} style={styles.startBtn}>
                  <Text style={styles.startBtnText}>Start Reading →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.priorityCtrl}>
                <TouchableOpacity onPress={() => adjustPriority(ub.id, 1)}>
                  <ChevronUp color={Colors.textMuted} size={18} />
                </TouchableOpacity>
                <View style={styles.priorityDots}>
                  {[1,2,3,4,5].map(p => (
                    <View key={p} style={[styles.dot, p <= ub.priority && styles.dotActive]} />
                  ))}
                </View>
                <TouchableOpacity onPress={() => adjustPriority(ub.id, -1)}>
                  <ChevronDown color={Colors.textMuted} size={18} />
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: Colors.forest, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontFamily: Typography.serif, fontSize: 22, color: Colors.white },
  headerSub: { fontFamily: Typography.sans, fontSize: 12, color: `${Colors.mint}99`, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  moodCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 14, ...Shadow.card },
  moodTitle: { fontFamily: Typography.sansSb, fontSize: 13, color: Colors.forest, marginBottom: 10 },
  moods: { flexDirection: 'row', gap: 8 },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.full, backgroundColor: Colors.creamDark,
  },
  moodChipActive: { backgroundColor: Colors.forest },
  moodEmoji: { fontSize: 14 },
  moodLabel: { fontFamily: Typography.sansMd, fontSize: 12, color: Colors.forest },
  moodLabelActive: { color: Colors.white },
  aiCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 14, ...Shadow.card },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiTitle: { fontFamily: Typography.sansSb, fontSize: 13, color: Colors.forest, flex: 1 },
  proBadge: { backgroundColor: `${Colors.gold}33`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  proBadgeText: { fontFamily: Typography.sansSb, fontSize: 10, color: Colors.gold },
  aiRec: { fontFamily: Typography.sans, fontSize: 14, color: Colors.text, lineHeight: 20 },
  aiHint: { fontFamily: Typography.sans, fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  sectionTitle: { fontFamily: Typography.serif, fontSize: 18, color: Colors.forest, marginTop: 4 },
  queueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 12, ...Shadow.card,
  },
  rank: { fontFamily: Typography.serif, fontSize: 16, color: Colors.creamDark, width: 28, textAlign: 'center' },
  queueCover: { width: 44, height: 60, borderRadius: Radius.sm },
  coverPlaceholder: { backgroundColor: Colors.forestLight, justifyContent: 'center', alignItems: 'center', padding: 4 },
  coverText: { fontFamily: Typography.serif, fontSize: 8, color: `${Colors.cream}CC`, textAlign: 'center' },
  queueInfo: { flex: 1 },
  queueTitle: { fontFamily: Typography.sansSb, fontSize: 14, color: Colors.forest },
  queueAuthor: { fontFamily: Typography.sans, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  startBtn: { marginTop: 6 },
  startBtnText: { fontFamily: Typography.sansSb, fontSize: 12, color: Colors.terra },
  priorityCtrl: { alignItems: 'center', gap: 4 },
  priorityDots: { gap: 2 },
  dot: { width: 4, height: 8, borderRadius: 2, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.mint },
})
