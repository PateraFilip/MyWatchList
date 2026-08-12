export type MediaType = 'movie' | 'tv';
export type ListStatus = 'watchlist' | 'watched';

export interface WatchItemSource {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  belongs_to_collection?: { id: number } | null;
  number_of_seasons?: number;
}

export interface TmdbSearchResult {
  id: number;
  media_type: MediaType | 'person';
  title?: string;
  name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  known_for_department?: string;
  known_for?: {
    id: number;
    media_type?: MediaType;
    title?: string;
    name?: string;
  }[];
}

export interface PersonRef {
  id: number;
  name: string;
  profilePath?: string | null;
  job?: string;
  character?: string;
}

export interface TmdbCredits {
  cast: {
    id: number;
    name: string;
    character?: string;
    profile_path: string | null;
    order?: number;
    roles?: { character: string }[];
  }[];
  crew: {
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
  }[];
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: { id: number; name: string }[];
  tagline?: string;
  status: string;
  belongs_to_collection: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
  credits?: TmdbCredits;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  vote_average: number;
  genres: { id: number; name: string }[];
  tagline?: string;
  status: string;
  seasons: TmdbSeasonSummary[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
  credits?: TmdbCredits;
  aggregate_credits?: TmdbCredits;
  next_episode_to_air: {
    air_date: string;
    episode_number: number;
    season_number: number;
    name: string;
  } | null;
}

export interface TmdbPersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
}

export interface TmdbPersonCredit {
  id: number;
  media_type: MediaType;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  job?: string;
  department?: string;
  vote_average?: number;
  episode_count?: number;
  genre_ids?: number[];
}

export interface TmdbSeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

export interface TmdbEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  vote_average: number;
}

export interface TmdbSeasonDetails {
  id: number;
  name: string;
  season_number: number;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TmdbEpisode[];
}

export interface TmdbCollection {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  parts: {
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
    overview: string;
  }[];
}

/** Per-díl stav u seriálu */
export type EpisodeListStatus = 'watchlist' | 'watched';

export interface SeasonProgress {
  /** Celá série označená jako zhlédnutá */
  watched: boolean;
  /** Stav jednotlivých dílů (watchlist / watched) */
  episodes: Record<number, EpisodeListStatus>;
}

export interface WatchItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year?: string;
  /** ISO YYYY-MM-DD — premiéra filmu / první odvysílání seriálu */
  releaseDate?: string | null;
  status: ListStatus;
  rating: number | null;
  comment: string;
  addedAt: string;
  watchedAt?: string;
  seasons: Record<number, SeasonProgress>;
  knownSeasonCount: number;
  collectionId: number | null;
  collectionName?: string | null;
  knownCollectionMovieIds: number[];
  /** Metadata pro filtry — doplní se při otevření detailu */
  tmdbRating?: number | null;
  genres?: { id: number; name: string }[];
  cast?: PersonRef[];
  directors?: PersonRef[];
  creators?: PersonRef[];
  /** true = žánry/lidi už jsou v SQLite, netahat z API znovu */
  metadataSynced?: boolean;
}

export type ListSortKey =
  | 'added'
  | 'title'
  | 'userRating'
  | 'tmdbRating'
  | 'year';

export interface ListFilterState {
  mediaType: 'all' | 'movie' | 'tv';
  genreId: number | null;
  collectionId: number | null;
  personId: number | null;
  personRole: 'any' | 'cast' | 'crew';
  minUserRating: number | null;
  maxUserRating: number | null;
  minTmdbRating: number | null;
  maxTmdbRating: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  hasComment: boolean | null;
  sort: ListSortKey;
  sortAsc: boolean;
}

export const DEFAULT_LIST_FILTERS: ListFilterState = {
  mediaType: 'all',
  genreId: null,
  collectionId: null,
  personId: null,
  personRole: 'any',
  minUserRating: null,
  maxUserRating: null,
  minTmdbRating: null,
  maxTmdbRating: null,
  yearFrom: null,
  yearTo: null,
  hasComment: null,
  sort: 'added',
  sortAsc: false,
};

export type NotificationType =
  | 'new_season'
  | 'new_collection_movie'
  | 'upcoming_release';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  mediaType: MediaType;
  tmdbId: number;
  relatedTitle?: string;
  /** ISO datum premiéry / vydání (YYYY-MM-DD), pokud je známé */
  releaseDate?: string | null;
  createdAt: string;
  read: boolean;
}
