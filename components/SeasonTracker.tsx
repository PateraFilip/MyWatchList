import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSeasonDetails } from '@/src/api/tmdb';
import type { EpisodeListStatus, TmdbSeasonDetails, TmdbSeasonSummary } from '@/src/types';
import { useWatchlistStore } from '@/src/store/watchlistStore';
import { colors, radius, spacing } from '@/src/theme/colors';
import { countSeasonStatus, seasonHasStatus } from '@/src/utils/tvProgress';

interface Props {
  tvId: number;
  seasons: TmdbSeasonSummary[];
  showTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate?: string;
  numberOfSeasons?: number;
}

export function SeasonTracker({
  tvId,
  seasons,
  showTitle,
  posterPath,
  backdropPath,
  firstAirDate,
  numberOfSeasons,
}: Props) {
  const usable = seasons.filter((s) => s.season_number > 0);
  const [selected, setSelected] = useState(usable[0]?.season_number ?? 1);
  const [details, setDetails] = useState<TmdbSeasonDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = useWatchlistStore((s) => s.getItem('tv', tvId));
  const setEpisodeStatus = useWatchlistStore((s) => s.setEpisodeStatus);
  const setSeasonStatus = useWatchlistStore((s) => s.setSeasonStatus);
  const addItem = useWatchlistStore((s) => s.addItem);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getSeasonDetails(tvId, selected);
        if (!cancelled) setDetails(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chyba načítání');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tvId, selected]);

  const seasonProgress = item?.seasons[selected];
  const episodeCount = details?.episodes.length ?? 0;
  const epNumbers = details?.episodes.map((e) => e.episode_number) ?? [];
  const watchedCount = countSeasonStatus(seasonProgress, 'watched', epNumbers);
  const watchlistCount = countSeasonStatus(seasonProgress, 'watchlist', epNumbers);
  const allWatched = seasonHasStatus(seasonProgress, 'watched', episodeCount);
  const allWatchlist = seasonHasStatus(seasonProgress, 'watchlist', episodeCount);

  const ensureInList = (preferred: EpisodeListStatus = 'watchlist') => {
    if (!item) {
      addItem(
        {
          id: tvId,
          name: showTitle,
          poster_path: posterPath,
          backdrop_path: backdropPath,
          first_air_date: firstAirDate,
          number_of_seasons: numberOfSeasons,
        },
        'tv',
        preferred
      );
    }
  };

  const toggleEpisode = (episodeNumber: number, status: EpisodeListStatus) => {
    ensureInList(status);
    const current = seasonProgress?.episodes[episodeNumber];
    setEpisodeStatus(
      tvId,
      selected,
      episodeNumber,
      current === status ? null : status
    );
  };

  const toggleSeason = (status: EpisodeListStatus) => {
    ensureInList(status);
    const already =
      status === 'watched' ? allWatched : allWatchlist;
    setSeasonStatus(tvId, selected, already ? null : status, episodeCount);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Série a díly</Text>
      <Text style={styles.hint}>
        Každý díl můžeš dát zvlášť ke zhlédnutí nebo mezi zhlédnuté.
      </Text>

      <View style={styles.seasonRow}>
        {usable.map((season) => {
          const active = season.season_number === selected;
          const progress = item?.seasons[season.season_number];
          const done =
            progress?.watched ||
            (progress &&
              season.episode_count > 0 &&
              Object.values(progress.episodes).filter((s) => s === 'watched')
                .length >= season.episode_count);
          const planned =
            progress &&
            Object.values(progress.episodes).some((s) => s === 'watchlist');
          return (
            <Pressable
              key={season.id}
              onPress={() => setSelected(season.season_number)}
              style={[styles.seasonChip, active && styles.seasonChipActive]}
            >
              <Text style={[styles.seasonChipText, active && styles.seasonChipTextActive]}>
                S{season.season_number}
              </Text>
              {done ? (
                <Ionicons
                  name="checkmark"
                  size={12}
                  color={active ? colors.bg : colors.success}
                />
              ) : planned ? (
                <Ionicons
                  name="bookmark"
                  size={11}
                  color={active ? colors.bg : colors.accent}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {details ? (
        <View style={styles.seasonHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.seasonTitle}>{details.name}</Text>
            <Text style={styles.seasonMeta}>
              {watchedCount} zhl. · {watchlistCount} plán · {episodeCount} dílů
              {details.air_date ? ` · ${details.air_date.slice(0, 4)}` : ''}
            </Text>
          </View>
          <View style={styles.seasonActions}>
            <Pressable
              style={[styles.markSeason, allWatchlist && styles.markSeasonAccent]}
              onPress={() => toggleSeason('watchlist')}
            >
              <Ionicons
                name={allWatchlist ? 'bookmark' : 'bookmark-outline'}
                size={14}
                color={allWatchlist ? colors.bg : colors.accent}
              />
              <Text
                style={[
                  styles.markSeasonText,
                  allWatchlist && styles.markSeasonTextOn,
                ]}
              >
                Série
              </Text>
            </Pressable>
            <Pressable
              style={[styles.markSeasonDoneBtn, allWatched && styles.markSeasonDoneOn]}
              onPress={() => toggleSeason('watched')}
            >
              <Ionicons
                name={allWatched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={14}
                color={allWatched ? colors.bg : colors.success}
              />
              <Text
                style={[
                  styles.markSeasonDoneText,
                  allWatched && styles.markSeasonTextOn,
                ]}
              >
                Série
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {details?.episodes.map((ep) => {
        const status = seasonProgress?.episodes[ep.episode_number];
        const watched = status === 'watched';
        const planned = status === 'watchlist';
        return (
          <View
            key={ep.id}
            style={[
              styles.episode,
              watched && styles.episodeWatched,
              planned && styles.episodePlanned,
            ]}
          >
            <View style={styles.episodeBody}>
              <Text style={styles.episodeTitle} numberOfLines={1}>
                {ep.episode_number}. {ep.name || 'Díl'}
              </Text>
              {ep.overview ? (
                <Text style={styles.episodeOverview} numberOfLines={2}>
                  {ep.overview}
                </Text>
              ) : null}
            </View>
            {ep.runtime ? (
              <Text style={styles.runtime}>{ep.runtime} min</Text>
            ) : null}
            <View style={styles.epActions}>
              <Pressable
                style={[styles.epBtn, planned && styles.epBtnAccent]}
                onPress={() => toggleEpisode(ep.episode_number, 'watchlist')}
                hitSlop={6}
              >
                <Ionicons
                  name={planned ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={planned ? colors.bg : colors.accent}
                />
              </Pressable>
              <Pressable
                style={[styles.epBtn, watched && styles.epBtnSuccess]}
                onPress={() => toggleEpisode(ep.episode_number, 'watched')}
                hitSlop={6}
              >
                <Ionicons
                  name={watched ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={18}
                  color={watched ? colors.bg : colors.success}
                />
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  heading: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 28,
    color: colors.text,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textDim,
    marginTop: -4,
  },
  seasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seasonChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  seasonChipText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: colors.textMuted,
  },
  seasonChipTextActive: {
    color: colors.bg,
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  seasonTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  seasonMeta: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  seasonActions: {
    flexDirection: 'row',
    gap: 6,
  },
  markSeason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  markSeasonAccent: {
    backgroundColor: colors.accent,
  },
  markSeasonDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.successSoft,
  },
  markSeasonDoneOn: {
    backgroundColor: colors.success,
  },
  markSeasonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: colors.accent,
  },
  markSeasonDoneText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: colors.success,
  },
  markSeasonTextOn: {
    color: colors.bg,
  },
  episode: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  episodeWatched: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  episodePlanned: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  episodeBody: {
    flex: 1,
    gap: 4,
  },
  episodeTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  episodeOverview: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  runtime: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  epActions: {
    flexDirection: 'row',
    gap: 4,
  },
  epBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
  },
  epBtnAccent: {
    backgroundColor: colors.accent,
  },
  epBtnSuccess: {
    backgroundColor: colors.success,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    color: colors.danger,
    fontSize: 13,
  },
});
