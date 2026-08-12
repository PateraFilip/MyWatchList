import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS watch_items (
  key TEXT PRIMARY KEY NOT NULL,
  id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  year TEXT,
  status TEXT NOT NULL,
  rating REAL,
  comment TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL,
  watched_at TEXT,
  seasons_json TEXT NOT NULL DEFAULT '{}',
  known_season_count INTEGER NOT NULL DEFAULT 0,
  collection_id INTEGER,
  collection_name TEXT,
  known_collection_ids_json TEXT NOT NULL DEFAULT '[]',
  tmdb_rating REAL,
  metadata_synced INTEGER NOT NULL DEFAULT 0,
  release_date TEXT
);

CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_genres (
  item_key TEXT NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (item_key, genre_id),
  FOREIGN KEY (item_key) REFERENCES watch_items(key) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id)
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  profile_path TEXT
);

CREATE TABLE IF NOT EXISTS item_people (
  item_key TEXT NOT NULL,
  person_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  character TEXT,
  job TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_key, person_id, role),
  FOREIGN KEY (item_key) REFERENCES watch_items(key) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  media_type TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  related_title TEXT,
  release_date TEXT,
  created_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_watch_items_status ON watch_items(status);
CREATE INDEX IF NOT EXISTS idx_item_people_person ON item_people(person_id);
CREATE INDEX IF NOT EXISTS idx_item_genres_genre ON item_genres(genre_id);
`;

export function getDb(): SQLiteDatabase {
  if (!db) {
    db = openDatabaseSync('watchlist.db');
    db.execSync(SCHEMA);
    migrate(db);
  }
  return db;
}

function migrate(database: SQLiteDatabase) {
  const cols = database.getAllSync<{ name: string }>('PRAGMA table_info(watch_items)');
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('release_date')) {
    database.execSync('ALTER TABLE watch_items ADD COLUMN release_date TEXT');
  }

  const notifCols = database.getAllSync<{ name: string }>('PRAGMA table_info(notifications)');
  const notifNames = new Set(notifCols.map((c) => c.name));
  if (!notifNames.has('release_date')) {
    database.execSync('ALTER TABLE notifications ADD COLUMN release_date TEXT');
  }
}

export function itemKey(mediaType: string, id: number): string {
  return `${mediaType}:${id}`;
}
