import type { EpisodeListStatus, ListStatus, SeasonProgress, WatchItem } from '@/src/types';

/** Normalize legacy boolean episode maps → EpisodeListStatus */
export function normalizeSeasonProgress(raw: SeasonProgress | undefined): SeasonProgress {
  if (!raw) return { watched: false, episodes: {} };
  const episodes: Record<number, EpisodeListStatus> = {};
  Object.entries(raw.episodes || {}).forEach(([ep, val]) => {
    const n = Number(ep);
    const v = val as EpisodeListStatus | boolean;
    if (v === true || v === 'watched') episodes[n] = 'watched';
    else if (v === 'watchlist') episodes[n] = 'watchlist';
  });
  return {
    watched: !!raw.watched,
    episodes,
  };
}

export function normalizeItemSeasons(item: WatchItem): WatchItem {
  const seasons: Record<number, SeasonProgress> = {};
  Object.entries(item.seasons || {}).forEach(([k, v]) => {
    seasons[Number(k)] = normalizeSeasonProgress(v as SeasonProgress);
  });
  return { ...item, seasons };
}

function flattenEpisodeStatuses(item: WatchItem): EpisodeListStatus[] {
  const out: EpisodeListStatus[] = [];
  Object.values(item.seasons || {}).forEach((season) => {
    const s = normalizeSeasonProgress(season);
    Object.values(s.episodes).forEach((st) => out.push(st));
  });
  return out;
}

export function countEpisodesByStatus(
  item: WatchItem,
  status: EpisodeListStatus
): number {
  return flattenEpisodeStatuses(item).filter((s) => s === status).length;
}

/** Seriál se může objevit v obou seznamech podle dílů. */
export function itemAppearsInList(item: WatchItem, list: ListStatus): boolean {
  if (item.mediaType !== 'tv') return item.status === list;

  const statuses = flattenEpisodeStatuses(item);
  const hasWatchlistEp = statuses.some((s) => s === 'watchlist');
  const hasWatchedEp = statuses.some((s) => s === 'watched');

  if (list === 'watched') {
    return hasWatchedEp || (item.status === 'watched' && statuses.length === 0);
  }

  if (hasWatchlistEp) return true;
  if (item.status !== 'watchlist') return false;
  // celý seriál na watchlistu bez dílů, nebo se smíšenými stavy
  if (statuses.length === 0) return true;
  // jen zhlédnuté díly → nepatří do watchlistu
  if (hasWatchedEp && !hasWatchlistEp) return false;
  return true;
}

export function seasonHasStatus(
  progress: SeasonProgress | undefined,
  status: EpisodeListStatus,
  episodeCount: number
): boolean {
  const s = normalizeSeasonProgress(progress);
  if (status === 'watched' && s.watched && episodeCount > 0) return true;
  if (episodeCount <= 0) return false;
  let n = 0;
  for (let i = 1; i <= episodeCount; i += 1) {
    if (s.episodes[i] === status) n += 1;
  }
  return n === episodeCount;
}

export function countSeasonStatus(
  progress: SeasonProgress | undefined,
  status: EpisodeListStatus,
  episodeNumbers: number[]
): number {
  const s = normalizeSeasonProgress(progress);
  return episodeNumbers.filter((n) => s.episodes[n] === status).length;
}
