import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CreditsRow } from '@/components/CreditsRow';
import { ListActions } from '@/components/ListActions';
import { MediaPoster } from '@/components/MediaPoster';
import { TypeBadge } from '@/components/TypeBadge';
import { UserNotes } from '@/components/UserNotes';
import { creditsFromMovie } from '@/src/api/credits';
import {
  backdropUrl,
  getCollection,
  getMovieDetails,
} from '@/src/api/tmdb';
import type { TmdbCollection, TmdbMovieDetails } from '@/src/types';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, radius, spacing } from '@/src/theme/colors';
import { formatRuntime } from '@/src/utils/format';

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const movieId = Number(id);
  const [details, setDetails] = useState<TmdbMovieDetails | null>(null);
  const [collection, setCollection] = useState<TmdbCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncFromDetails = useWatchlistStore((s) => s.syncFromDetails);
  const people = useMemo(
    () => (details ? creditsFromMovie(details) : null),
    [details]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMovieDetails(movieId);
        if (cancelled) return;
        setDetails(data);
        syncFromDetails('movie', data);
        if (data.belongs_to_collection) {
          const col = await getCollection(data.belongs_to_collection.id);
          if (!cancelled) setCollection(col);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chyba načítání');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (movieId) load();
    return () => {
      cancelled = true;
    };
  }, [movieId, syncFromDetails]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error || !details) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Film nenalezen'}</Text>
      </View>
    );
  }

  const backdrop = backdropUrl(details.backdrop_path);
  const runtime = formatRuntime(details.runtime);

  return (
    <>
      <Stack.Screen options={{ title: details.title }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={styles.backdrop} contentFit="cover" />
          ) : (
            <View style={[styles.backdrop, styles.backdropFallback]} />
          )}
          <LinearGradient
            colors={['transparent', colors.bg]}
            style={styles.gradient}
          />
          <View style={styles.heroContent}>
            <MediaPoster path={details.poster_path} width={120} height={180} />
            <View style={styles.heroText}>
              <TypeBadge type="movie" />
              <Text style={styles.title}>{details.title}</Text>
              <Text style={styles.meta}>
                {[
                  details.release_date?.slice(0, 4),
                  runtime,
                  details.vote_average ? `TMDB ${details.vote_average.toFixed(1)}` : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
              {details.genres?.length ? (
                <Text style={styles.genres}>
                  {details.genres.map((g) => g.name).join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ListActions
            mediaType="movie"
            id={details.id}
            title={details.title}
            source={details}
          />
        </View>

        {details.tagline ? (
          <Text style={styles.tagline}>„{details.tagline}"</Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>O filmu</Text>
          <Text style={styles.overview}>
            {details.overview || 'Popis není k dispozici.'}
          </Text>
        </View>

        {people?.directors.length ? (
          <View style={styles.creditsSection}>
            <CreditsRow title="Režie" people={people.directors} />
          </View>
        ) : null}
        {people?.keyCrew.length ? (
          <View style={styles.creditsSection}>
            <CreditsRow
              title="Štáb"
              people={people.keyCrew.filter((p) => p.job !== 'Director')}
            />
          </View>
        ) : null}
        {people?.cast.length ? (
          <View style={styles.creditsSection}>
            <CreditsRow title="Herci" people={people.cast} />
          </View>
        ) : null}

        <View style={styles.section}>
          <UserNotes mediaType="movie" id={details.id} />
        </View>

        {collection ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Kolekce: {collection.name}</Text>
            <Text style={styles.collectionHint}>
              Nové filmy z této série uvidíš v záložce Novinky.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.collectionRow}>
                {collection.parts
                  .slice()
                  .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
                  .map((part) => (
                    <Pressable
                      key={part.id}
                      style={styles.collectionItem}
                      onPress={() => {
                        if (part.id !== details.id) router.push(`/movie/${part.id}`);
                      }}
                    >
                      <MediaPoster path={part.poster_path} width={90} height={135} />
                      <Text style={styles.collectionTitle} numberOfLines={2}>
                        {part.title}
                      </Text>
                      <Text style={styles.collectionYear}>
                        {part.release_date?.slice(0, 4) || '—'}
                      </Text>
                      {part.id === details.id ? (
                        <View style={styles.currentBadge}>
                          <Ionicons name="ellipse" size={8} color={colors.accent} />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    textAlign: 'center',
  },
  hero: {
    height: 320,
    marginBottom: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  backdropFallback: {
    backgroundColor: colors.bgSoft,
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-end',
  },
  heroText: {
    flex: 1,
    gap: 6,
    paddingBottom: 4,
  },
  title: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 34,
    color: colors.text,
    letterSpacing: 0.5,
    lineHeight: 36,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  genres: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  creditsSection: {
    marginBottom: spacing.xl,
  },
  tagline: {
    fontFamily: 'DMSans_400Regular',
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.accent,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  heading: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  overview: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  collectionHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  collectionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  collectionItem: {
    width: 90,
    gap: 4,
  },
  collectionTitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.text,
  },
  collectionYear: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textDim,
  },
  currentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.overlay,
    borderRadius: radius.sm,
    padding: 4,
  },
});
