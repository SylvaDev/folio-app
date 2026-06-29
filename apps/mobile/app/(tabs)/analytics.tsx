import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BarChart } from 'victory-native'
import { BookOpen, TrendingUp, Target, Star, Flame } from 'lucide-react-native'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/store/useAuthStore'
import { calcCompletionRate } from '@folio/shared'
import { Colors, Typography, Radius, Shadow } from '../../src/lib/theme'

export default function AnalyticsScreen() {
  const user = useAuthStore(s => s.user)
  const [stats, setStats] = useState<any>(null)
  const [monthlyData, setMonthlyData] = useState<{ x: string; y: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('user_reading_stats').select('*').eq('user_id', user.id).single(),
      supabase.from('user_books').select('*, book:books(page_count, genres)').eq('user_id', user.id),
    ]).then(([{ data: s }, { data: ub }]) => {
      setStats(s)

      // Build monthly data
      const books = (ub ?? []).filter((b: any) => b.status === 'read' && b.date_finished)
      const now = new Date()
      const months: { x: string; y: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toISOString().slice(0, 7)
        const label = d.toLocaleDateString('en-US', { month: 'short' })
        const count = books.filter((b: any) => b.date_finished?.startsWith(key)).length
        months.push({ x: label, y: count })
      }
      setMonthlyData(months)
      setLoading(false)
    })
  }, [user])

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator color={Colors.mint} size="large" /></View>
  }

  const KPIS = [
    { icon: BookOpen, label: 'This year', value: stats?.read_this_year ?? 0, color: Colors.forest },
    { icon: TrendingUp, label: 'All time', value: stats?.total_read ?? 0, color: Colors.forestLight },
    { icon: Target, label: 'TBR pile', value: stats?.tbr_count ?? 0, color: Colors.terra },
    { icon: Star, label: 'Avg rating', value: stats?.avg_rating ? `${stats.avg_rating}★` : '—', color: Colors.gold },
  ]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          {KPIS.map(({ icon: Icon, label, value, color }) => (
            <View key={label} style={styles.kpiCard}>
              <Icon color={color} size={18} />
              <Text style={[styles.kpiValue, { color }]}>{value}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Monthly chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Books per month</Text>
          <BarChart
            data={monthlyData}
            x="x"
            y="y"
            style={{
              data: { fill: Colors.forestLight, width: 28, borderRadius: 6 },
              parent: { marginLeft: -20 },
            }}
            height={180}
            padding={{ top: 16, bottom: 40, left: 40, right: 16 }}
            domainPadding={{ x: 12 }}
          />
        </View>

        {/* Streak cards */}
        <View style={styles.streakRow}>
          <View style={[styles.streakCard, { backgroundColor: `${Colors.terra}15` }]}>
            <Flame color={Colors.terra} size={20} />
            <Text style={[styles.streakValue, { color: Colors.terra }]}>—</Text>
            <Text style={styles.streakLabel}>Current streak</Text>
          </View>
          <View style={[styles.streakCard, { backgroundColor: `${Colors.forestLight}15` }]}>
            <TrendingUp color={Colors.forestLight} size={20} />
            <Text style={[styles.streakValue, { color: Colors.forestLight }]}>
              {stats?.total_pages_read?.toLocaleString() ?? 0}
            </Text>
            <Text style={styles.streakLabel}>Total pages</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: Colors.forest, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontFamily: Typography.serif, fontSize: 22, color: Colors.white },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 14,
    alignItems: 'flex-start', gap: 4, ...Shadow.card,
  },
  kpiValue: { fontFamily: Typography.serif, fontSize: 26, fontWeight: 'bold' },
  kpiLabel: { fontFamily: Typography.sans, fontSize: 12, color: Colors.textMuted },
  chartCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 14, ...Shadow.card },
  chartTitle: { fontFamily: Typography.sansSb, fontSize: 14, color: Colors.forest, marginBottom: 8 },
  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: {
    flex: 1, borderRadius: Radius.xl, padding: 14, alignItems: 'center', gap: 6,
  },
  streakValue: { fontFamily: Typography.serif, fontSize: 24 },
  streakLabel: { fontFamily: Typography.sans, fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
})
