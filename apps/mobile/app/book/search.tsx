import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, Search, BookOpen } from 'lucide-react-native'
import { searchBooks, mapSearchResultToBook, type OpenLibrarySearchResult } from '@folio/shared'
import { supabase } from '../../src/lib/supabase'
import { useAuthStore } from '../../src/store/useAuthStore'
import { Colors, Typography, Radius, Shadow } from '../../src/lib/theme'

export default function BookSearchScreen() {
  const user = useAuthStore(s => s.user)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibrarySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<TextInput>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchBooks(query, 15)
        setResults(data.docs)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function addBook(result: OpenLibrarySearchResult, status: 'tbr' | 'reading') {
    if (!user) return
    setAdding(result.key + status)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const bookData = mapSearchResultToBook(result)
      const { data: book, error: be } = await supabase
        .from('books')
        .upsert(bookData, { onConflict: 'ol_key' })
        .select()
        .single()

      if (be || !book) throw be

      await supabase.from('user_books').upsert({
        user_id: user.id,
        book_id: book.id,
        status,
        date_added: new Date().toISOString(),
      }, { onConflict: 'user_id,book_id' })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Added!', `"${book.title}" added to your ${status === 'tbr' ? 'TBR' : 'reading list'}.`, [
        { text: 'Keep searching', style: 'cancel' },
        { text: 'Go to library', onPress: () => router.replace('/(tabs)') },
      ])
    } catch (err) {
      Alert.alert('Error', 'Could not add book. Please try again.')
    } finally {
      setAdding(null)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ArrowLeft color={Colors.white} size={20} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Search color={Colors.textMuted} size={16} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title, author, ISBN…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
          {loading && <ActivityIndicator color={Colors.mint} size="small" />}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            {!query
              ? <><Search color={Colors.border} size={40} /><Text style={styles.emptyText}>Search for books above</Text></>
              : !loading
              ? <><BookOpen color={Colors.border} size={40} /><Text style={styles.emptyText}>No results for "{query}"</Text></>
              : null
            }
          </View>
        }
        renderItem={({ item }) => {
          const coverUrl = item.cover_i
            ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`
            : null
          return (
            <View style={styles.resultRow}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Text style={styles.coverText} numberOfLines={2}>{item.title}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.author} numberOfLines={1}>
                  {item.author_name?.slice(0, 2).join(', ')}
                  {item.first_publish_year && ` · ${item.first_publish_year}`}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => addBook(item, 'tbr')}
                  disabled={adding?.startsWith(item.key)}
                  style={styles.tbrBtn}
                >
                  <Text style={styles.tbrBtnText}>TBR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => addBook(item, 'reading')}
                  disabled={adding?.startsWith(item.key)}
                  style={styles.readingBtn}
                >
                  <Text style={styles.readingBtnText}>Reading</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.forest, padding: 12,
  },
  back: { padding: 4 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: Typography.sans, fontSize: 14, color: Colors.text },
  list: { padding: 12, gap: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: Typography.sans, fontSize: 14, color: Colors.textMuted },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 12, ...Shadow.card,
  },
  cover: { width: 44, height: 60, borderRadius: Radius.sm },
  coverPlaceholder: { backgroundColor: Colors.forestLight, justifyContent: 'center', alignItems: 'center', padding: 4 },
  coverText: { fontFamily: Typography.serif, fontSize: 8, color: `${Colors.cream}CC`, textAlign: 'center' },
  info: { flex: 1 },
  title: { fontFamily: Typography.sansSb, fontSize: 14, color: Colors.forest },
  author: { fontFamily: Typography.sans, fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  actions: { gap: 6 },
  tbrBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, backgroundColor: Colors.creamDark,
  },
  tbrBtnText: { fontFamily: Typography.sansSb, fontSize: 11, color: Colors.forest },
  readingBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, backgroundColor: Colors.forest,
  },
  readingBtnText: { fontFamily: Typography.sansSb, fontSize: 11, color: Colors.white },
})
