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
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MediaCard } from '@/components/MediaCard';
import {
  genresFromIds,
  getGenreMaps,
  getPersonCombinedCredits,
  getPersonDetails,
  mediaTitle,
  mediaYear,
  profileUrl,
  type GenreMaps,
} from '@/src/api/tmdb';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import type { MediaType, TmdbPersonCredit, TmdbPersonDetails } from '@/src/types';
import { colors, radius, spacing } from '@/src/theme/colors';

type Tab = 'acting' | 'directing' | 'crew';

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = Number(id);
  const [details, setDetails] = useState<TmdbPersonDetails | null>(null);
  const [cast, setCast] = useState<TmdbPersonCredit[]>([]);
  const [crew, setCrew] = useState<TmdbPersonCredit[]>([]);
  const [genreMaps, setGenreMaps] = useState<GenreMaps | null>(null);
  const [tab, setTab] = useState<Tab>('acting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [person, credits, maps] = await Promise.all([
          getPersonDetails(personId),
          getPersonCombinedCredits(personId),
          getGenreMaps().catch(() => null),
        ]);
        if (cancelled) return;
        setDetails(person);
        setCast(credits.cast);
        setCrew(credits.crew);
        setGenreMaps(maps);
        if (person.known_for_department === 'Directing') setTab('directing');
        else if (person.known_for_department === 'Acting') setTab('acting');
        else if (!credits.cast.length && credits.crew.length) setTab('crew');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chyba načítání');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (personId) load();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  const directing = useMemo(
    () => crew.filter((c) => c.job === 'Director'),
    [crew]
  );
  const otherCrew = useMemo(
    () => crew.filter((c) => c.job !== 'Director'),
    [crew]
  );

  const list = tab === 'acting' ? cast : tab === 'directing' ? directing : otherCrew;

  const { movies, tvShows } = useMemo(() => {
    const sortCredits = (items: TmdbPersonCredit[]) =>
      [...items].sort((a, b) => {
        const ay = mediaYear(a) || '0000';
        const by = mediaYear(b) || '0000';
        return by.localeCompare(ay);
      });

    return {
      movies: sortCredits(list.filter((c) => c.media_type === 'movie')),
      tvShows: sortCredits(list.filter((c) => c.media_type === 'tv')),
    };
  }, [list]);


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
        <Text style={styles.error}>{error || 'Osoba nenalezena'}</Text>
      </View>
    );
  }

  const photo = profileUrl(details.profile_path, 'h632');

  return (
    <>
      <Stack.Screen options={{ title: details.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.photoWrap}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={48} color={colors.textDim} />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{details.name}</Text>
            <Text style={styles.meta}>
              {[
                details.known_for_department,
                details.birthday
                  ? `* ${new Date(details.birthday).toLocaleDateString('cs-CZ')}`
                  : null,
                details.place_of_birth,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
            {details.deathday ? (
              <Text style={styles.meta}>
                † {new Date(details.deathday).toLocaleDateString('cs-CZ')}
              </Text>
            ) : null}
          </View>
        </View>

        {details.biography ? (
          <View style={styles.section}>
            <Text style={styles.heading}>Biografie</Text>
            <Text style={styles.bio}>{details.biography}</Text>
          </View>
        ) : null}

        <View style={styles.tabs}>
          <TabChip
            label={`Herectví (${cast.length})`}
            active={tab === 'acting'}
            onPress={() => setTab('acting')}
          />
          <TabChip
            label={`Režie (${directing.length})`}
            active={tab === 'directing'}
            onPress={() => setTab('directing')}
          />
          <TabChip
            label={`Štáb (${otherCrew.length})`}
            active={tab === 'crew'}
            onPress={() => setTab('crew')}
          />
        </View>

        {movies.length === 0 && tvShows.length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.empty}>V této kategorii nic není.</Text>
          </View>
        ) : (
          <>
            {movies.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>Filmy ({movies.length})</Text>
                {movies.map((credit) => (
                  <CreditRow
                    key={`movie-${credit.id}-${credit.job || credit.character || ''}`}
                    credit={credit}
                    genreMaps={genreMaps}
                  />
                ))}
              </View>
            ) : null}
            {tvShows.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>Seriály ({tvShows.length})</Text>
                {tvShows.map((credit) => (
                  <CreditRow
                    key={`tv-${credit.id}-${credit.job || credit.character || ''}-${credit.episode_count || 0}`}
                    credit={credit}
                    genreMaps={genreMaps}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}

      </ScrollView>
    </>
  );
}

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CreditRow({
  credit,
  genreMaps,
}: {
  credit: TmdbPersonCredit;
  genreMaps: GenreMaps | null;
}) {
  const mediaType = credit.media_type as MediaType;
  const stored = useWatchlistStore((s) => s.getItem(mediaType, credit.id));
  const roleLabel = credit.character
    ? `jako ${credit.character}`
    : credit.job || null;

  const genres =
    stored?.genres && stored.genres.length > 0
      ? stored.genres
      : genresFromIds(mediaType, credit.genre_ids, genreMaps);

  return (
    <MediaCard
      item={{
        id: credit.id,
        mediaType,
        title: mediaTitle(credit),
        posterPath: stored?.posterPath || credit.poster_path,
        year: mediaYear(credit) || stored?.year,
        tmdbRating: stored?.tmdbRating ?? credit.vote_average ?? null,
        rating: stored?.rating ?? null,
        genres,
        comment: stored?.comment,
        seasons: stored?.seasons,
      }}
      roleLabel={roleLabel}
    />
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
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  photoWrap: {
    width: 120,
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: { width: '100%', height: '100%' },
  headerText: { flex: 1, gap: 8, justifyContent: 'flex-end' },
  name: {
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
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  heading: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 26,
    color: colors.text,
  },
  bio: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  tabText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.accent },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.textDim,
  },
});

