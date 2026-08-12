import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchResultItem } from '@/components/SearchResultItem';
import { getGenreMaps, hasApiKey, searchMulti, type GenreMaps } from '@/src/api/tmdb';
import type { TmdbSearchResult } from '@/src/types';
import { colors, radius, spacing } from '@/src/theme/colors';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genreMaps, setGenreMaps] = useState<GenreMaps | null>(null);

  useEffect(() => {
    getGenreMaps()
      .then(setGenreMaps)
      .catch(() => {});
  }, []);


  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    if (!hasApiKey()) {
      setError('Nejdřív nastav TMDB API klíč v Nastavení.');
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchMulti(query);
        setResults(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Vyhledávání selhalo');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [query]);

  const subtitle = query.trim()
    ? loading
      ? 'Hledám…'
      : `${results.length} výsledků`
    : 'Filmy, seriály i osoby z TMDB';

  return (
    <View style={styles.container}>
      <ScreenHeader title="HLEDAT" subtitle={subtitle} />

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.textDim} />
        <TextInput
          style={styles.input}
          placeholder="Film, seriál nebo osoba…"
          placeholderTextColor={colors.textDim}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.textDim}
            onPress={() => setQuery('')}
          />
        ) : null}
      </View>

      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(item) => `${item.media_type}-${item.id}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          !loading && query.trim() && !error ? (
            <EmptyState
              icon="search-outline"
              title="Nic nenalezeno"
              subtitle="Zkus jiný název nebo zkontroluj překlep."
            />
          ) : !query.trim() ? (
            <EmptyState
              icon="film-outline"
              title="Hledej ve TMDB"
              subtitle="Zadej název filmu, seriálu nebo osoby. Data pocházejí z The Movie Database."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <SearchResultItem item={item} genreMaps={genreMaps} />
        )}

      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: colors.text,
  },
  list: {
    paddingVertical: spacing.lg,
    paddingBottom: 40,
    flexGrow: 1,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    marginTop: spacing.md,
    fontSize: 13,
  },
});
