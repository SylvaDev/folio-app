import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Plus, Search, Grid, List } from 'lucide-react-native'
import type { UserBook } from '@folio/shared'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/store/useAuthStore'
import { Colors, Typography, Radius, Shadow } from '../../src/lib/theme'

const STATUS_TABS = [
  { key: 'all',     label: 'All' },
  { key: 'reading', label: 'Reading' },
  { key: 'tbr',     label: 'TBR' },
  { key: 'read',    label: 'Read' },
  { key: 'dnf',     label: 'DNF' },
]

const STATUS_COLORS: Record<string, string> = {
  tbr: Colors.creamDark,
  reading: '#D1FAE5',
  read: Colors.forestLight,
  dnf: '#FEE2E2',
  paused: '#FEF3C7',
}

export default function LibraryScreen() {
  const user = useAuthStore(s => s.user)
  const [books, setBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const fetchBooks = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_books')
      .select('*, book:books(*)')
      .eq('user_id', user.id)
      .order('date_added', { ascending: false })
    setBooks((data as UserBook[]) ?? [])
  }, [user])

  useEffect(() => {
    fetchBooks().finally(() => setLoading(false))
  }, [fetchBooks])

  async function onRefresh() {
    setRefreshing(true)
    await fetchBooks()
    setRefreshing(false)
  }

  const filtered = books.filter(b => {
    if (activeTab !== 'all' && b.status !== activeTab) return false
    if (search && !b.book?.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.mint} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Library</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setView(v => v === 'grid' ? 'list' : 'grid')} style={styles.iconBtn}>
            {view === 'grid'
              ? <List color={Colors.white} size={20} />
              : <Grid color={Colors.white} size={20} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/book/search')}
          >
            <Plus color={Colors.white} size={18} />
            <Text style={styles.addBtnText}>Add Book</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search color={Colors.textMuted} size={16} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search your library…"
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Status tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Books */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={view === 'grid' ? styles.grid : styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.mint} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No books here yet</Text>
            <Text style={styles.emptyText}>Tap "Add Book" to start building your library</Text>
          </View>
        ) : filtered.map(ub => (
          view === 'grid'
            ? <GridItem key={ub.id} userBook={ub} />
            : <ListItem key={ub.id} userBook={ub} />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

function GridItem({ userBook }: { userBook: UserBook }) {
  const book = userBook.book as any
  if (!book) return null
  const coverUrl = book.cover_url

  return (
    <TouchableOpacity style={styles.gridItem}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverTitle} numberOfLines={3}>{book.title}</Text>
        </View>
      )}
      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[userBook.status] ?? Colors.creamDark }]} />
    </TouchableOpacity>
  )
}

function ListItem({ userBook }: { userBook: UserBook }) {
  const book = userBook.book as any
  if (!book) return null

  return (
    <TouchableOpacity style={styles.listItem}>
      {book.cover_url ? (
        <Image source={{ uri: book.cover_url }} style={styles.listCover} contentFit="cover" />
      ) : (
        <View style={[styles.listCover, styles.coverPlaceholder]}>
          <Text style={styles.coverTitleSm} numberOfLines={2}>{book.title}</Text>
        </View>
      )}
      <View style={styles.listInfo}>
        <Text style={styles.listTitle} numberOfLines={1}>{book.title}</Text>
        <Text style={styles.listAuthor} numberOfLines={1}>{book.authors?.slice(0, 2).join(', ')}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[userBook.status] ?? Colors.creamDark }]}>
        <Text style={styles.statusText}>{userBook.status === 'tbr' ? 'TBR' : userBook.status}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.forest,
  },
  headerTitle: { fontFamily: Typography.serif, fontSize: 22, color: Colors.white },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.terra, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
  },
  addBtnText: { fontFamily: Typography.sansSb, fontSize: 13, color: Colors.white },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: Colors.white, borderRadius: Radius.lg,
    paddingHorizontal: 12, ...Shadow.card,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: Typography.sans, fontSize: 14, color: Colors.text, paddingVertical: 12 },
  tabsScroll: { maxHeight: 48 },
  tabsContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center', paddingBottom: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.creamDark,
  },
  tabActive: { backgroundColor: Colors.forest },
  tabText: { fontFamily: Typography.sansMd, fontSize: 13, color: Colors.textMuted },
  tabTextActive: { color: Colors.white },
  scroll: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8 },
  listContainer: { padding: 12, gap: 8 },
  gridItem: {
    width: '30%',
    aspectRatio: 2/3,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
    ...Shadow.card,
  },
  cover: { width: '100%', height: '100%', borderRadius: Radius.lg },
  coverPlaceholder: {
    backgroundColor: Colors.forestLight,
    justifyContent: 'center', alignItems: 'center', padding: 6,
  },
  coverTitle: { fontFamily: Typography.serif, fontSize: 9, color: `${Colors.cream}CC`, textAlign: 'center' },
  coverTitleSm: { fontFamily: Typography.serif, fontSize: 8, color: `${Colors.cream}CC`, textAlign: 'center' },
  statusDot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: 5 },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 12, ...Shadow.card,
  },
  listCover: { width: 44, height: 60, borderRadius: Radius.sm },
  listInfo: { flex: 1 },
  listTitle: { fontFamily: Typography.sansSb, fontSize: 14, color: Colors.forest },
  listAuthor: { fontFamily: Typography.sans, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontFamily: Typography.sansMd, fontSize: 11, color: Colors.forest, textTransform: 'capitalize' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontFamily: Typography.serif, fontSize: 18, color: Colors.forest, marginBottom: 8 },
  emptyText: { fontFamily: Typography.sans, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
})
