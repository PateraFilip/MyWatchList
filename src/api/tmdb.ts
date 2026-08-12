import Constants from 'expo-constants';
import type {
  MediaType,
  TmdbCollection,
  TmdbMovieDetails,
  TmdbPersonCredit,
  TmdbPersonDetails,
  TmdbSearchResult,
  TmdbSeasonDetails,
  TmdbTvDetails,
} from '@/src/types';

export type GenreMaps = {
  movie: Map<number, string>;
  tv: Map<number, string>;
};

let genreMapsCache: GenreMaps | null = null;
let genreMapsPromise: Promise<GenreMaps> | null = null;

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

function getApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_TMDB_API_KEY;
  const fromExtra = Constants.expoConfig?.extra?.tmdbApiKey as string | undefined;
  // Odstraní uvozovky / "Bearer " pokud je uživatel omylem zkopíroval do .env
  return (fromEnv || fromExtra || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

/** JWT Read Access Token začíná "eyJ", v3 API key je krátký hex řetězec. */
function isBearerToken(key: string): boolean {
  return key.startsWith('eyJ');
}

export function posterUrl(
  path: string | null | undefined,
  size: 'w185' | 'w342' | 'w500' | 'original' = 'w342'
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(
  path: string | null | undefined,
  size: 'w780' | 'w1280' | 'original' = 'w780'
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

export function profileUrl(
  path: string | null | undefined,
  size: 'w185' | 'h632' | 'original' = 'w185'
): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Chybí TMDB API klíč. Nastav EXPO_PUBLIC_TMDB_API_KEY v souboru .env');
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('language', 'cs-CZ');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (isBearerToken(apiKey)) {
    // API Read Access Token (v4) — Authorization header
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    // Klasický API Key (v3) — query parametr
    url.searchParams.set('api_key', apiKey);
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB chyba ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function searchMulti(query: string): Promise<TmdbSearchResult[]> {
  if (!query.trim()) return [];
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>('/search/multi', {
    query: query.trim(),
    include_adult: 'false',
  });
  return data.results.filter(
    (item) =>
      item.media_type === 'movie' ||
      item.media_type === 'tv' ||
      item.media_type === 'person'
  );
}

export async function getMovieDetails(id: number): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, {
    append_to_response: 'credits',
  });
}

export async function getTvDetails(id: number): Promise<TmdbTvDetails> {
  return tmdbFetch<TmdbTvDetails>(`/tv/${id}`, {
    append_to_response: 'aggregate_credits,credits',
  });
}

export async function getPersonDetails(id: number): Promise<TmdbPersonDetails> {
  return tmdbFetch<TmdbPersonDetails>(`/person/${id}`);
}

export async function getPersonCombinedCredits(id: number): Promise<{
  cast: TmdbPersonCredit[];
  crew: TmdbPersonCredit[];
}> {
  const data = await tmdbFetch<{ cast: TmdbPersonCredit[]; crew: TmdbPersonCredit[] }>(
    `/person/${id}/combined_credits`
  );
  return {
    cast: (data.cast || []).filter(
      (c) => c.media_type === 'movie' || c.media_type === 'tv'
    ),
    crew: (data.crew || []).filter(
      (c) => c.media_type === 'movie' || c.media_type === 'tv'
    ),
  };
}

export async function getSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<TmdbSeasonDetails> {
  return tmdbFetch<TmdbSeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function getCollection(id: number): Promise<TmdbCollection> {
  return tmdbFetch<TmdbCollection>(`/collection/${id}`);
}

export function mediaTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || 'Bez názvu';
}

export function mediaYear(item: {
  release_date?: string;
  first_air_date?: string;
}): string | undefined {
  const date = item.release_date || item.first_air_date;
  return date ? date.slice(0, 4) : undefined;
}

/** Cached TMDB genre id → name maps (cs-CZ). */
export async function getGenreMaps(): Promise<GenreMaps> {
  if (genreMapsCache) return genreMapsCache;
  if (!genreMapsPromise) {
    genreMapsPromise = Promise.all([
      tmdbFetch<{ genres: { id: number; name: string }[] }>('/genre/movie/list'),
      tmdbFetch<{ genres: { id: number; name: string }[] }>('/genre/tv/list'),
    ])
      .then(([movie, tv]) => {
        genreMapsCache = {
          movie: new Map(movie.genres.map((g) => [g.id, g.name])),
          tv: new Map(tv.genres.map((g) => [g.id, g.name])),
        };
        return genreMapsCache;
      })
      .catch((err) => {
        genreMapsPromise = null;
        throw err;
      });
  }
  return genreMapsPromise;
}

export function genresFromIds(
  mediaType: MediaType,
  genreIds: number[] | undefined,
  maps: GenreMaps | null | undefined
): { id: number; name: string }[] {
  if (!genreIds?.length || !maps) return [];
  const map = maps[mediaType];
  return genreIds
    .map((id) => {
      const name = map.get(id);
      return name ? { id, name } : null;
    })
    .filter((g): g is { id: number; name: string } => g != null);
}
