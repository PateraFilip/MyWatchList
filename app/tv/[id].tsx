import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CreditsRow } from '@/components/CreditsRow';
import { ListActions } from '@/components/ListActions';
import { MediaPoster } from '@/components/MediaPoster';
import { SeasonTracker } from '@/components/SeasonTracker';
import { TypeBadge } from '@/components/TypeBadge';
import { UserNotes } from '@/components/UserNotes';
import { creditsFromTv } from '@/src/api/credits';
import { backdropUrl, getTvDetails } from '@/src/api/tmdb';
import type { TmdbTvDetails } from '@/src/types';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, spacing } from '@/src/theme/colors';
import { formatRuntime } from '@/src/utils/format';

export default function TvDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tvId = Number(id);
  const [details, setDetails] = useState<TmdbTvDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncFromDetails = useWatchlistStore((s) => s.syncFromDetails);
  const people = useMemo(
    () => (details ? creditsFromTv(details) : null),
    [details]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getTvDetails(tvId);
        if (cancelled) return;
        setDetails(data);
        syncFromDetails('tv', data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chyba načítání');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (tvId) load();
    return () => {
      cancelled = true;
    };
  }, [tvId, syncFromDetails]);

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
        <Text style={styles.error}>{error || 'Seriál nenalezen'}</Text>
      </View>
    );
  }

  const backdrop = backdropUrl(details.backdrop_path);
  const epRuntime = formatRuntime(details.episode_run_time?.[0]);

  return (
    <>
      <Stack.Screen options={{ title: details.name }} />
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
              <TypeBadge type="tv" />
              <Text style={styles.title}>{details.name}</Text>
              <Text style={styles.meta}>
                {[
                  details.first_air_date?.slice(0, 4),
                  `${details.number_of_seasons} s.`,
                  `${details.number_of_episodes} ep.`,
                  epRuntime,
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
              <Text style={styles.status}>Stav: {details.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ListActions
            mediaType="tv"
            id={details.id}
            title={details.name}
            source={details}
          />
        </View>

        {details.next_episode_to_air ? (
          <View style={styles.nextEp}>
            <Text style={styles.nextEpLabel}>Další díl</Text>
            <Text style={styles.nextEpText}>
              S{details.next_episode_to_air.season_number}E
              {details.next_episode_to_air.episode_number}
              {details.next_episode_to_air.name
                ? ` — ${details.next_episode_to_air.name}`
                : ''}
              {details.next_episode_to_air.air_date
                ? ` (${details.next_episode_to_air.air_date})`
                : ''}
            </Text>
          </View>
        ) : null}

        {details.tagline ? (
          <Text style={styles.tagline}>„{details.tagline}"</Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>O seriálu</Text>
          <Text style={styles.overview}>
            {details.overview || 'Popis není k dispozici.'}
          </Text>
        </View>

        {people?.creators.length ? (
          <View style={styles.creditsSection}>
            <CreditsRow title="Tvůrci" people={people.creators} />
          </View>
        ) : null}
        {people?.directors.length ? (
          <View style={styles.creditsSection}>
            <CreditsRow title="Režie" people={people.directors} />
          </View>
        ) : null}
        {people?.cast.length ? (
          <View style={styles.creditsSection}>
            <CreditsRow title="Herci" people={people.cast} />
          </View>
        ) : null}

        <View style={styles.section}>
          <UserNotes mediaType="tv" id={details.id} />
        </View>

        <View style={styles.section}>
          <SeasonTracker
            tvId={details.id}
            seasons={details.seasons}
            showTitle={details.name}
            posterPath={details.poster_path}
            backdropPath={details.backdrop_path}
            firstAirDate={details.first_air_date}
            numberOfSeasons={details.number_of_seasons}
          />
        </View>
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
    height: 340,
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
    fontSize: 12,
    color: colors.textMuted,
  },
  genres: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textDim,
  },
  status: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: colors.accent,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  creditsSection: {
    marginBottom: spacing.xl,
  },
  nextEp: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.tvSoft,
    borderWidth: 1,
    borderColor: colors.tv,
  },
  nextEpLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: colors.tv,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nextEpText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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
});
