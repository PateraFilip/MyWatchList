import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb, itemKey as makeKey } from '@/src/db/database';
import type {
  AppNotification,
  MediaType,
  PersonRef,
  SeasonProgress,
  WatchItem,
} from '@/src/types';

type ItemRow = {
  key: string;
  id: number;
  media_type: string;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  year: string | null;
  status: string;
  rating: number | null;
  comment: string;
  added_at: string;
  watched_at: string | null;
  seasons_json: string;
  known_season_count: number;
  collection_id: number | null;
  collection_name: string | null;
  known_collection_ids_json: string;
  tmdb_rating: number | null;
  metadata_synced: number;
  release_date?: string | null;
};

function parseSeasons(json: string): Record<number, SeasonProgress> {
  try {
    const raw = JSON.parse(json || '{}') as Record<
      string,
      SeasonProgress & { episodes?: Record<string, boolean | 'watchlist' | 'watched'> }
    >;
    const out: Record<number, SeasonProgress> = {};
    Object.entries(raw).forEach(([k, v]) => {
      const episodes: SeasonProgress['episodes'] = {};
      Object.entries(v?.episodes || {}).forEach(([ep, val]) => {
        if (val === true || val === 'watched') episodes[Number(ep)] = 'watched';
        else if (val === 'watchlist') episodes[Number(ep)] = 'watchlist';
      });
      out[Number(k)] = { watched: !!v?.watched, episodes };
    });
    return out;
  } catch {
    return {};
  }
}

function isMetadataSynced(item: WatchItem): boolean {
  if (item.metadataSynced) return true;
  return (
    item.tmdbRating != null ||
    (item.genres?.length || 0) > 0 ||
    (item.cast?.length || 0) > 0 ||
    (item.directors?.length || 0) > 0
  );
}

function rowToBaseItem(row: ItemRow): WatchItem {
  return {
    id: row.id,
    mediaType: row.media_type as MediaType,
    title: row.title,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    year: row.year ?? undefined,
    releaseDate: row.release_date ?? null,
    status: row.status as WatchItem['status'],
    rating: row.rating,
    comment: row.comment || '',
    addedAt: row.added_at,
    watchedAt: row.watched_at ?? undefined,
    seasons: parseSeasons(row.seasons_json),
    knownSeasonCount: row.known_season_count || 0,
    collectionId: row.collection_id,
    collectionName: row.collection_name,
    knownCollectionMovieIds: JSON.parse(row.known_collection_ids_json || '[]') as number[],
    tmdbRating: row.tmdb_rating,
    genres: [],
    cast: [],
    directors: [],
    creators: [],
    metadataSynced: row.metadata_synced === 1,
  };
}

function upsertGenre(id: number, name: string) {
  getDb().runSync(
    `INSERT INTO genres (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    id,
    name
  );
}

function upsertPerson(person: PersonRef) {
  getDb().runSync(
    `INSERT INTO people (id, name, profile_path) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       profile_path = COALESCE(excluded.profile_path, people.profile_path)`,
    person.id,
    person.name,
    person.profilePath ?? null
  );
}

function writeItemRelations(key: string, item: WatchItem) {
  const db = getDb();
  db.runSync('DELETE FROM item_genres WHERE item_key = ?', key);
  db.runSync('DELETE FROM item_people WHERE item_key = ?', key);

  for (const genre of item.genres || []) {
    upsertGenre(genre.id, genre.name);
    db.runSync(
      'INSERT OR REPLACE INTO item_genres (item_key, genre_id) VALUES (?, ?)',
      key,
      genre.id
    );
  }

  const linkPeople = (
    people: PersonRef[] | undefined,
    role: 'cast' | 'director' | 'creator'
  ) => {
    (people || []).forEach((person, index) => {
      upsertPerson(person);
      db.runSync(
        `INSERT OR REPLACE INTO item_people
          (item_key, person_id, role, character, job, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        key,
        person.id,
        role,
        person.character ?? null,
        person.job ?? null,
        index
      );
    });
  };

  linkPeople(item.cast, 'cast');
  linkPeople(item.directors, 'director');
  linkPeople(item.creators, 'creator');
}

function writeWatchItemRow(item: WatchItem, writeRelations: boolean) {
  const db = getDb();
  const key = makeKey(item.mediaType, item.id);
  const metadataSynced = isMetadataSynced(item) ? 1 : 0;

  db.runSync(
    `INSERT INTO watch_items (
      key, id, media_type, title, poster_path, backdrop_path, year, status,
      rating, comment, added_at, watched_at, seasons_json, known_season_count,
      collection_id, collection_name, known_collection_ids_json, tmdb_rating,
      metadata_synced, release_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      title = excluded.title,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      year = excluded.year,
      status = excluded.status,
      rating = excluded.rating,
      comment = excluded.comment,
      added_at = excluded.added_at,
      watched_at = excluded.watched_at,
      seasons_json = excluded.seasons_json,
      known_season_count = excluded.known_season_count,
      collection_id = excluded.collection_id,
      collection_name = excluded.collection_name,
      known_collection_ids_json = excluded.known_collection_ids_json,
      tmdb_rating = excluded.tmdb_rating,
      release_date = excluded.release_date,
      metadata_synced = CASE
        WHEN excluded.metadata_synced = 1 THEN 1
        ELSE watch_items.metadata_synced
      END`,
    key,
    item.id,
    item.mediaType,
    item.title,
    item.posterPath,
    item.backdropPath,
    item.year ?? null,
    item.status,
    item.rating,
    item.comment || '',
    item.addedAt,
    item.watchedAt ?? null,
    JSON.stringify(item.seasons || {}),
    item.knownSeasonCount || 0,
    item.collectionId,
    item.collectionName ?? null,
    JSON.stringify(item.knownCollectionMovieIds || []),
    item.tmdbRating ?? null,
    metadataSynced,
    item.releaseDate ?? null
  );

  if (writeRelations && metadataSynced) {
    writeItemRelations(key, item);
  }
}

export function upsertWatchItem(item: WatchItem): void {
  const writeRelations = isMetadataSynced(item);
  getDb().withTransactionSync(() => {
    writeWatchItemRow(item, writeRelations);
  });
}

export function deleteWatchItem(mediaType: MediaType, id: number): void {
  getDb().runSync('DELETE FROM watch_items WHERE key = ?', makeKey(mediaType, id));
}

export function replaceAllWatchItems(items: WatchItem[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM item_people');
    db.runSync('DELETE FROM item_genres');
    db.runSync('DELETE FROM watch_items');
    for (const item of items) {
      writeWatchItemRow(item, isMetadataSynced(item));
    }
  });
}

export function loadAllWatchItems(): Record<string, WatchItem> {
  const db = getDb();
  const rows = db.getAllSync<ItemRow>('SELECT * FROM watch_items');
  const items: Record<string, WatchItem> = {};

  for (const row of rows) {
    const item = rowToBaseItem(row);

    item.genres = db.getAllSync<{ id: number; name: string }>(
      `SELECT g.id, g.name FROM item_genres ig
       JOIN genres g ON g.id = ig.genre_id
       WHERE ig.item_key = ?
       ORDER BY g.name`,
      row.key
    );

    const people = db.getAllSync<{
      id: number;
      name: string;
      profile_path: string | null;
      role: string;
      character: string | null;
      job: string | null;
      sort_order: number;
    }>(
      `SELECT p.id, p.name, p.profile_path, ip.role, ip.character, ip.job, ip.sort_order
       FROM item_people ip
       JOIN people p ON p.id = ip.person_id
       WHERE ip.item_key = ?
       ORDER BY ip.sort_order ASC`,
      row.key
    );

    item.cast = [];
    item.directors = [];
    item.creators = [];
    for (const p of people) {
      const ref: PersonRef = {
        id: p.id,
        name: p.name,
        profilePath: p.profile_path,
        character: p.character ?? undefined,
        job: p.job ?? undefined,
      };
      if (p.role === 'cast') item.cast.push(ref);
      else if (p.role === 'director') item.directors.push(ref);
      else if (p.role === 'creator') item.creators.push(ref);
    }

    items[row.key] = item;
  }

  return items;
}

export function saveNotifications(notifications: AppNotification[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM notifications');
    for (const n of notifications.slice(0, 100)) {
      db.runSync(
        `INSERT INTO notifications
          (id, type, title, message, media_type, tmdb_id, related_title, created_at, is_read, release_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        n.id,
        n.type,
        n.title,
        n.message,
        n.mediaType,
        n.tmdbId,
        n.relatedTitle ?? null,
        n.createdAt,
        n.read ? 1 : 0,
        n.releaseDate ?? null
      );
    }
  });
}

export function loadNotifications(): AppNotification[] {
  const rows = getDb().getAllSync<{
    id: string;
    type: AppNotification['type'];
    title: string;
    message: string;
    media_type: MediaType;
    tmdb_id: number;
    related_title: string | null;
    created_at: string;
    is_read: number;
    release_date?: string | null;
  }>('SELECT * FROM notifications ORDER BY created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.message,
    mediaType: r.media_type,
    tmdbId: r.tmdb_id,
    relatedTitle: r.related_title ?? undefined,
    releaseDate: r.release_date ?? null,
    createdAt: r.created_at,
    read: r.is_read === 1,
  }));
}

export function setMeta(key: string, value: string | null): void {
  const db = getDb();
  if (value == null) {
    db.runSync('DELETE FROM app_meta WHERE key = ?', key);
    return;
  }
  db.runSync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

export function getMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export type PersistedBundle = {
  items: Record<string, WatchItem>;
  notifications: AppNotification[];
  lastNotificationCheck: string | null;
};

export function loadBundle(): PersistedBundle {
  return {
    items: loadAllWatchItems(),
    notifications: loadNotifications(),
    lastNotificationCheck: getMeta('lastNotificationCheck'),
  };
}

export function saveBundle(data: PersistedBundle): void {
  replaceAllWatchItems(Object.values(data.items));
  saveNotifications(data.notifications);
  setMeta('lastNotificationCheck', data.lastNotificationCheck);
}

export type DbFilterOptions = {
  genres: { id: number; name: string }[];
  collections: { id: number; name: string }[];
  people: { id: number; name: string; roles: string[] }[];
};

/** Filtry berou žánry/lidi/kolekce výhradně z lokální SQLite. */
export function loadFilterOptionsFromDb(): DbFilterOptions {
  const db = getDb();

  const genres = db.getAllSync<{ id: number; name: string }>(
    `SELECT DISTINCT g.id, g.name
     FROM genres g
     INNER JOIN item_genres ig ON ig.genre_id = g.id
     ORDER BY g.name COLLATE NOCASE`
  );

  const collections = db.getAllSync<{ id: number; name: string }>(
    `SELECT DISTINCT collection_id AS id, collection_name AS name
     FROM watch_items
     WHERE collection_id IS NOT NULL AND collection_name IS NOT NULL AND collection_name != ''
     ORDER BY collection_name COLLATE NOCASE`
  );

  const peopleRows = db.getAllSync<{ id: number; name: string; role: string }>(
    `SELECT p.id, p.name, ip.role
     FROM people p
     INNER JOIN item_people ip ON ip.person_id = p.id
     ORDER BY p.name COLLATE NOCASE`
  );

  const peopleMap = new Map<number, { id: number; name: string; roles: Set<string> }>();
  for (const row of peopleRows) {
    const prev = peopleMap.get(row.id) || {
      id: row.id,
      name: row.name,
      roles: new Set<string>(),
    };
    if (row.role === 'cast') prev.roles.add('cast');
    if (row.role === 'director' || row.role === 'creator') prev.roles.add('crew');
    peopleMap.set(row.id, prev);
  }

  return {
    genres,
    collections,
    people: Array.from(peopleMap.values()).map((p) => ({
      id: p.id,
      name: p.name,
      roles: Array.from(p.roles),
    })),
  };
}

/** Jednorázová migrace ze starého Zustand/AsyncStorage JSON. */
export async function migrateFromAsyncStorageIfNeeded(): Promise<boolean> {
  const migrated = getMeta('migrated_from_asyncstorage');
  if (migrated === '1') return false;

  const existing = getDb().getFirstSync<{ c: number }>(
    'SELECT COUNT(*) as c FROM watch_items'
  );
  if ((existing?.c || 0) > 0) {
    setMeta('migrated_from_asyncstorage', '1');
    return false;
  }

  try {
    const raw = await AsyncStorage.getItem('watchlist-storage');
    if (!raw) {
      setMeta('migrated_from_asyncstorage', '1');
      return false;
    }

    const parsed = JSON.parse(raw) as {
      state?: {
        items?: Record<string, WatchItem>;
        notifications?: AppNotification[];
        lastNotificationCheck?: string | null;
      };
    };

    const state = parsed.state;
    if (!state?.items || !Object.keys(state.items).length) {
      setMeta('migrated_from_asyncstorage', '1');
      return false;
    }

    const items: Record<string, WatchItem> = {};
    for (const [key, item] of Object.entries(state.items)) {
      items[key] = {
        ...item,
        metadataSynced: isMetadataSynced(item),
      };
    }

    saveBundle({
      items,
      notifications: state.notifications || [],
      lastNotificationCheck: state.lastNotificationCheck ?? null,
    });
    setMeta('migrated_from_asyncstorage', '1');
    return true;
  } catch {
    setMeta('migrated_from_asyncstorage', '1');
    return false;
  }
}
