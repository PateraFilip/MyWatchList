import { create } from 'zustand';
import { creditsFromMovie, creditsFromTv } from '@/src/api/credits';
import {
  getCollection,
  getMovieDetails,
  getTvDetails,
  mediaTitle,
  mediaYear,
} from '@/src/api/tmdb';
import { getDb } from '@/src/db/database';
import {
  deleteWatchItem,
  loadBundle,
  migrateFromAsyncStorageIfNeeded,
  saveBundle,
  saveNotifications,
  setMeta,
  upsertWatchItem,
} from '@/src/db/watchlistRepository';
import type {
  AppNotification,
  EpisodeListStatus,
  ListStatus,
  MediaType,
  SeasonProgress,
  TmdbMovieDetails,
  TmdbTvDetails,
  WatchItem,
  WatchItemSource,
} from '@/src/types';
import { countEpisodesByStatus, itemAppearsInList } from '@/src/utils/tvProgress';
import { isNotificationRelevant, isWithinLastDays, premiereLabel } from '@/src/utils/format';

interface WatchlistState {
  items: Record<string, WatchItem>;
  notifications: AppNotification[];
  lastNotificationCheck: string | null;
  hydrated: boolean;

  hydrateFromDb: () => Promise<void>;
  setHydrated: (value: boolean) => void;
  getItem: (mediaType: MediaType, id: number) => WatchItem | undefined;
  addItem: (source: WatchItemSource, mediaType: MediaType, status: ListStatus) => void;
  removeItem: (mediaType: MediaType, id: number) => void;
  setStatus: (mediaType: MediaType, id: number, status: ListStatus) => void;
  setRating: (mediaType: MediaType, id: number, rating: number | null) => void;
  setComment: (mediaType: MediaType, id: number, comment: string) => void;
  setEpisodeStatus: (
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    status: EpisodeListStatus | null
  ) => void;
  setSeasonStatus: (
    tvId: number,
    seasonNumber: number,
    status: EpisodeListStatus | null,
    episodeCount: number
  ) => void;
  /** @deprecated use setEpisodeStatus */
  setEpisodeWatched: (
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean
  ) => void;
  /** @deprecated use setSeasonStatus */
  setSeasonWatched: (
    tvId: number,
    seasonNumber: number,
    watched: boolean,
    episodeCount: number
  ) => void;
  syncFromDetails: (mediaType: MediaType, details: TmdbMovieDetails | TmdbTvDetails) => void;
  enrichItem: (mediaType: MediaType, id: number) => Promise<void>;
  enrichMissingMetadata: () => Promise<number>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  checkForUpdates: () => Promise<number>;
  restoreFromBackup: (data: {
    items: Record<string, WatchItem>;
    notifications: AppNotification[];
    lastNotificationCheck: string | null;
  }) => void;
  getBackupSnapshot: () => {
    items: Record<string, WatchItem>;
    notifications: AppNotification[];
    lastNotificationCheck: string | null;
  };
}

function itemKey(mediaType: MediaType, id: number): string {
  return `${mediaType}:${id}`;
}

function emptySeason(): SeasonProgress {
  return { watched: false, episodes: {} };
}

function needsMetadata(item: WatchItem): boolean {
  return !item.metadataSynced;
}

function persistItem(item: WatchItem) {
  try {
    upsertWatchItem(item);
  } catch (e) {
    console.warn('SQLite upsert failed', e);
  }
}

function persistNotifications(notifications: AppNotification[]) {
  try {
    saveNotifications(notifications);
  } catch (e) {
    console.warn('SQLite notifications failed', e);
  }
}

function createWatchItem(
  source: WatchItemSource,
  mediaType: MediaType,
  status: ListStatus
): WatchItem {
  const now = new Date().toISOString();
  return {
    id: source.id,
    mediaType,
    title: mediaTitle(source),
    posterPath: source.poster_path ?? null,
    backdropPath: source.backdrop_path ?? null,
    year: mediaYear(source),
    releaseDate: source.release_date || source.first_air_date || null,
    status,
    rating: null,
    comment: '',
    addedAt: now,
    watchedAt: status === 'watched' ? now : undefined,
    seasons: {},
    knownSeasonCount: mediaType === 'tv' ? (source.number_of_seasons ?? 0) : 0,
    collectionId:
      mediaType === 'movie' ? (source.belongs_to_collection?.id ?? null) : null,
    collectionName: null,
    knownCollectionMovieIds: [],
    tmdbRating: null,
    genres: [],
    cast: [],
    directors: [],
    creators: [],
    metadataSynced: false,
  };
}

function updateItem(
  get: () => WatchlistState,
  set: (partial: Partial<WatchlistState> | ((s: WatchlistState) => Partial<WatchlistState>)) => void,
  key: string,
  updater: (item: WatchItem) => WatchItem
) {
  const current = get().items[key];
  if (!current) return;
  const next = updater(current);
  set((state) => ({
    items: { ...state.items, [key]: next },
  }));
  persistItem(next);
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: {},
  notifications: [],
  lastNotificationCheck: null,
  hydrated: false,

  setHydrated: (value) => set({ hydrated: value }),

  hydrateFromDb: async () => {
    try {
      getDb(); // init schema
      await migrateFromAsyncStorageIfNeeded();
      const bundle = loadBundle();
      set({
        items: bundle.items,
        notifications: bundle.notifications,
        lastNotificationCheck: bundle.lastNotificationCheck,
        hydrated: true,
      });
    } catch (e) {
      console.warn('SQLite hydrate failed', e);
      set({ hydrated: true });
    }
  },

  getItem: (mediaType, id) => get().items[itemKey(mediaType, id)],

  addItem: (source, mediaType, status) => {
    const key = itemKey(mediaType, source.id);
    const existing = get().items[key];
    if (existing) {
      get().setStatus(mediaType, source.id, status);
      if (needsMetadata(existing)) {
        void get().enrichItem(mediaType, source.id);
      }
      return;
    }
    const created = createWatchItem(source, mediaType, status);
    set((state) => ({
      items: { ...state.items, [key]: created },
    }));
    persistItem(created);
    void get().enrichItem(mediaType, source.id);
  },

  removeItem: (mediaType, id) => {
    const key = itemKey(mediaType, id);
    set((state) => {
      const next = { ...state.items };
      delete next[key];
      return { items: next };
    });
    try {
      deleteWatchItem(mediaType, id);
    } catch (e) {
      console.warn('SQLite delete failed', e);
    }
  },

  setStatus: (mediaType, id, status) => {
    updateItem(get, set, itemKey(mediaType, id), (item) => ({
      ...item,
      status,
      watchedAt:
        status === 'watched' ? item.watchedAt || new Date().toISOString() : undefined,
    }));
  },

  setRating: (mediaType, id, rating) => {
    updateItem(get, set, itemKey(mediaType, id), (item) => ({ ...item, rating }));
  },

  setComment: (mediaType, id, comment) => {
    updateItem(get, set, itemKey(mediaType, id), (item) => ({ ...item, comment }));
  },

  setEpisodeStatus: (tvId, seasonNumber, episodeNumber, status) => {
    updateItem(get, set, itemKey('tv', tvId), (item) => {
      const season = item.seasons[seasonNumber] || emptySeason();
      const episodes = { ...season.episodes };
      if (status == null) delete episodes[episodeNumber];
      else episodes[episodeNumber] = status;

      const next: WatchItem = {
        ...item,
        seasons: {
          ...item.seasons,
          [seasonNumber]: { ...season, watched: false, episodes },
        },
      };

      // Udrž overall status: má-li plánované díly → watchlist, jinak při zhlédnutých → watched
      const planned = countEpisodesByStatus(next, 'watchlist');
      const done = countEpisodesByStatus(next, 'watched');
      if (planned > 0) next.status = 'watchlist';
      else if (done > 0 && item.status === 'watchlist') next.status = 'watched';

      return next;
    });
  },

  setSeasonStatus: (tvId, seasonNumber, status, episodeCount) => {
    updateItem(get, set, itemKey('tv', tvId), (item) => {
      const episodes: SeasonProgress['episodes'] = {};
      if (status) {
        for (let i = 1; i <= episodeCount; i += 1) episodes[i] = status;
      }
      const next: WatchItem = {
        ...item,
        seasons: {
          ...item.seasons,
          [seasonNumber]: {
            watched: status === 'watched',
            episodes,
          },
        },
      };
      const planned = countEpisodesByStatus(next, 'watchlist');
      const done = countEpisodesByStatus(next, 'watched');
      if (planned > 0) next.status = 'watchlist';
      else if (done > 0) next.status = 'watched';
      return next;
    });
  },

  setEpisodeWatched: (tvId, seasonNumber, episodeNumber, watched) => {
    get().setEpisodeStatus(tvId, seasonNumber, episodeNumber, watched ? 'watched' : null);
  },

  setSeasonWatched: (tvId, seasonNumber, watched, episodeCount) => {
    get().setSeasonStatus(tvId, seasonNumber, watched ? 'watched' : null, episodeCount);
  },

  syncFromDetails: (mediaType, details) => {
    const key = itemKey(mediaType, details.id);
    updateItem(get, set, key, (item) => {
      if (mediaType === 'movie') {
        const movie = details as TmdbMovieDetails;
        const credits = creditsFromMovie(movie);
        return {
          ...item,
          title: movie.title,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
          year: mediaYear(movie),
          releaseDate: movie.release_date || item.releaseDate || null,
          collectionId: movie.belongs_to_collection?.id ?? item.collectionId,
          collectionName:
            movie.belongs_to_collection?.name ?? item.collectionName ?? null,
          tmdbRating: movie.vote_average,
          genres: movie.genres || [],
          cast: credits.cast,
          directors: credits.directors,
          creators: [],
          metadataSynced: true,
        };
      }

      const tv = details as TmdbTvDetails;
      const credits = creditsFromTv(tv);
      return {
        ...item,
        title: tv.name,
        posterPath: tv.poster_path,
        backdropPath: tv.backdrop_path,
        year: mediaYear(tv),
        releaseDate: tv.first_air_date || item.releaseDate || null,
        knownSeasonCount: Math.max(item.knownSeasonCount, tv.number_of_seasons),
        tmdbRating: tv.vote_average,
        genres: tv.genres || [],
        cast: credits.cast,
        directors: credits.directors,
        creators: credits.creators,
        metadataSynced: true,
      };
    });
  },

  enrichItem: async (mediaType, id) => {
    try {
      const details =
        mediaType === 'movie' ? await getMovieDetails(id) : await getTvDetails(id);
      if (!get().getItem(mediaType, id)) return;
      get().syncFromDetails(mediaType, details);
    } catch {
      // ignore
    }
  },

  enrichMissingMetadata: async () => {
    const missing = Object.values(get().items).filter(needsMetadata);
    if (!missing.length) return 0;

    const concurrency = 3;
    let index = 0;
    let done = 0;

    async function worker() {
      while (index < missing.length) {
        const current = missing[index];
        index += 1;
        await get().enrichItem(current.mediaType, current.id);
        done += 1;
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, missing.length) }, () => worker())
    );
    return done;
  },

  markNotificationRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      persistNotifications(notifications);
      return { notifications };
    });
  },

  markAllNotificationsRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }));
      persistNotifications(notifications);
      return { notifications };
    });
  },

  clearNotifications: () => {
    persistNotifications([]);
    set({ notifications: [] });
  },

  getBackupSnapshot: () => {
    const { items, notifications, lastNotificationCheck } = get();
    return { items, notifications, lastNotificationCheck };
  },

  restoreFromBackup: (data) => {
    const items: Record<string, WatchItem> = {};
    for (const [key, item] of Object.entries(data.items ?? {})) {
      items[key] = {
        ...item,
        metadataSynced:
          item.metadataSynced ||
          item.tmdbRating != null ||
          (item.genres?.length || 0) > 0 ||
          (item.cast?.length || 0) > 0,
      };
    }
    const bundle = {
      items,
      notifications: data.notifications ?? [],
      lastNotificationCheck: data.lastNotificationCheck ?? null,
    };
    try {
      saveBundle(bundle);
    } catch (e) {
      console.warn('SQLite restore failed', e);
    }
    set({
      items: bundle.items,
      notifications: bundle.notifications,
      lastNotificationCheck: bundle.lastNotificationCheck,
    });
  },

  checkForUpdates: async () => {
    const { items } = get();
    const list = Object.values(items);
    const newNotifications: AppNotification[] = [];
    const upcoming: AppNotification[] = [];
    const updates: Record<string, WatchItem> = {};

    for (const item of list) {
      try {
        const isWatched = itemAppearsInList(item, 'watched');
        const isWatchlist = itemAppearsInList(item, 'watchlist');

        if (item.mediaType === 'tv') {
          const details = await getTvDetails(item.id);
          const realSeasons = details.seasons.filter((s) => s.season_number > 0);
          const currentCount = realSeasons.length;
          const previous = item.knownSeasonCount || 0;

          // Nové série jen u zhlédnutých (nebo částečně zhlédnutých) seriálů
          if (isWatched && previous > 0 && currentCount > previous) {
            const newestSeasons = realSeasons
              .filter((s) => s.season_number > previous)
              .sort((a, b) => a.season_number - b.season_number);
            for (const newest of newestSeasons) {
              const air = newest.air_date;
              const dateLabel = premiereLabel(air, 'season');
              newNotifications.push({
                id: `season-${item.id}-${newest.season_number}`,
                type: 'new_season',
                title: 'Nová série',
                message: dateLabel
                  ? `${item.title}: ${newest.name} · ${dateLabel}`
                  : `${item.title}: vyšla ${newest.name}`,
                mediaType: 'tv',
                tmdbId: item.id,
                relatedTitle: item.title,
                releaseDate: air,
                createdAt: new Date().toISOString(),
                read: false,
              });
            }
          }

          // Watchlist — premiéra / další díl
          if (isWatchlist) {
            const next = details.next_episode_to_air;
            const release =
              next?.air_date || details.first_air_date || item.releaseDate || null;
            if (release) {
              const label = next
                ? premiereLabel(release, 'episode')
                : premiereLabel(release, 'tv');
              const detail = next
                ? `S${next.season_number}E${next.episode_number}${next.name ? ` „${next.name}"` : ''}`
                : null;
              upcoming.push({
                id: `upcoming-tv-${item.id}`,
                type: 'upcoming_release',
                title: item.title,
                message: [detail, label].filter(Boolean).join(' · '),
                mediaType: 'tv',
                tmdbId: item.id,
                relatedTitle: item.title,
                releaseDate: release,
                createdAt: new Date().toISOString(),
                read: false,
              });
            }
          }

          updates[itemKey('tv', item.id)] = {
            ...item,
            knownSeasonCount: Math.max(previous, currentCount),
            title: details.name,
            posterPath: details.poster_path,
            releaseDate: details.first_air_date || item.releaseDate || null,
          };
        } else if (item.collectionId && isWatched) {
          const collection = await getCollection(item.collectionId);
          const partIds = collection.parts.map((p) => p.id);
          const known = new Set(item.knownCollectionMovieIds);
          const isFirstSync = item.knownCollectionMovieIds.length === 0;

          if (!isFirstSync) {
            for (const part of collection.parts) {
              if (!known.has(part.id) && part.id !== item.id) {
                const dateLabel = premiereLabel(part.release_date, 'movie');
                newNotifications.push({
                  id: `collection-${item.collectionId}-${part.id}`,
                  type: 'new_collection_movie',
                  title: 'Nový film v kolekci',
                  message: dateLabel
                    ? `${part.title} · ${dateLabel} · „${collection.name}"`
                    : `${part.title} — součást „${collection.name}"`,
                  mediaType: 'movie',
                  tmdbId: part.id,
                  relatedTitle: part.title,
                  releaseDate: part.release_date || null,
                  createdAt: new Date().toISOString(),
                  read: false,
                });
              }
            }
          }

          updates[itemKey('movie', item.id)] = {
            ...item,
            knownCollectionMovieIds: partIds,
          };
        } else if (item.mediaType === 'movie') {
          const details = await getMovieDetails(item.id);
          const release = details.release_date || item.releaseDate || null;

          if (details.belongs_to_collection) {
            const collection = await getCollection(details.belongs_to_collection.id);
            const partIds = collection.parts.map((p) => p.id);
            const known = new Set(item.knownCollectionMovieIds);
            const isFirstSync = item.knownCollectionMovieIds.length === 0;

            if (isWatched && !isFirstSync) {
              for (const part of collection.parts) {
                if (!known.has(part.id) && part.id !== item.id) {
                  const dateLabel = premiereLabel(part.release_date, 'movie');
                  newNotifications.push({
                    id: `collection-${details.belongs_to_collection.id}-${part.id}`,
                    type: 'new_collection_movie',
                    title: 'Nový film v kolekci',
                    message: dateLabel
                      ? `${part.title} · ${dateLabel} · „${collection.name}"`
                      : `${part.title} — součást „${collection.name}"`,
                    mediaType: 'movie',
                    tmdbId: part.id,
                    relatedTitle: part.title,
                    releaseDate: part.release_date || null,
                    createdAt: new Date().toISOString(),
                    read: false,
                  });
                }
              }
            }

            updates[itemKey('movie', item.id)] = {
              ...item,
              collectionId: details.belongs_to_collection.id,
              collectionName: details.belongs_to_collection.name,
              knownCollectionMovieIds: partIds,
              title: details.title,
              posterPath: details.poster_path,
              releaseDate: release,
            };
          } else {
            updates[itemKey('movie', item.id)] = {
              ...item,
              title: details.title,
              posterPath: details.poster_path,
              releaseDate: release,
            };
          }

          if (isWatchlist && release) {
            upcoming.push({
              id: `upcoming-movie-${item.id}`,
              type: 'upcoming_release',
              title: item.title || details.title,
              message: premiereLabel(release, 'movie') || release,
              mediaType: 'movie',
              tmdbId: item.id,
              relatedTitle: details.title,
              releaseDate: release,
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        }
      } catch {
        // continue
      }
    }

    // Dedup nové novinky (stejné id = nepřidávat znovu pokud už existuje)
    const existingIds = new Set(get().notifications.map((n) => n.id));
    const freshNews = newNotifications
      .filter((n) => !existingIds.has(n.id))
      .filter((n) => isNotificationRelevant(n, 30));

    // Watchlist premiéry: budoucí + max. měsíc po premiéře
    const upcomingFresh = upcoming.filter((n) =>
      n.releaseDate ? isWithinLastDays(n.releaseDate, 30) : true
    );
    upcomingFresh.sort((a, b) => {
      const ad = a.releaseDate || '9999';
      const bd = b.releaseDate || '9999';
      return ad.localeCompare(bd);
    });

    const lastCheck = new Date().toISOString();
    set((state) => {
      const itemsNext = { ...state.items, ...updates };
      const kept = state.notifications
        .filter((n) => n.type !== 'upcoming_release')
        .filter((n) => isNotificationRelevant(n, 30));
      const notifications = [...freshNews, ...upcomingFresh, ...kept].slice(0, 120);
      Object.values(updates).forEach((item) => persistItem(item));
      persistNotifications(notifications);
      setMeta('lastNotificationCheck', lastCheck);
      return {
        items: itemsNext,
        notifications,
        lastNotificationCheck: lastCheck,
      };
    });

    return freshNews.length + upcomingFresh.length;
  },
}));

export function selectUnreadCount(state: WatchlistState) {
  return state.notifications.filter((n) => !n.read).length;
}
