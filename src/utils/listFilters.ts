import type { ListFilterState, ListStatus, WatchItem } from '@/src/types';
import { DEFAULT_LIST_FILTERS } from '@/src/types';
import { itemAppearsInList } from '@/src/utils/tvProgress';


export function countActiveFilters(filters: ListFilterState): number {
  let n = 0;
  if (filters.mediaType !== 'all') n += 1;
  if (filters.genreId != null) n += 1;
  if (filters.collectionId != null) n += 1;
  if (filters.personId != null) n += 1;
  if (filters.minUserRating != null) n += 1;
  if (filters.maxUserRating != null) n += 1;
  if (filters.minTmdbRating != null) n += 1;
  if (filters.maxTmdbRating != null) n += 1;
  if (filters.yearFrom != null) n += 1;
  if (filters.yearTo != null) n += 1;
  if (filters.hasComment != null) n += 1;
  if (filters.sort !== 'added' || filters.sortAsc) n += 1;
  return n;
}

export function applyListFilters(
  items: WatchItem[],
  status: ListStatus,
  filters: ListFilterState
): WatchItem[] {
  const filtered = items.filter((item) => {
    if (!itemAppearsInList(item, status)) return false;
    if (filters.mediaType !== 'all' && item.mediaType !== filters.mediaType) return false;

    if (filters.genreId != null) {
      if (!item.genres?.some((g) => g.id === filters.genreId)) return false;
    }

    if (filters.collectionId != null) {
      if (item.collectionId !== filters.collectionId) return false;
    }

    if (filters.personId != null) {
      const inCast = item.cast?.some((p) => p.id === filters.personId);
      const inDirectors = item.directors?.some((p) => p.id === filters.personId);
      const inCreators = item.creators?.some((p) => p.id === filters.personId);
      if (filters.personRole === 'cast' && !inCast) return false;
      if (filters.personRole === 'crew' && !inDirectors && !inCreators) return false;
      if (filters.personRole === 'any' && !inCast && !inDirectors && !inCreators) {
        return false;
      }
    }

    if (filters.minUserRating != null) {
      if (item.rating == null || item.rating < filters.minUserRating) return false;
    }
    if (filters.maxUserRating != null) {
      if (item.rating == null || item.rating > filters.maxUserRating) return false;
    }

    if (filters.minTmdbRating != null) {
      if (item.tmdbRating == null || item.tmdbRating < filters.minTmdbRating) return false;
    }
    if (filters.maxTmdbRating != null) {
      if (item.tmdbRating == null || item.tmdbRating > filters.maxTmdbRating) return false;
    }

    const year = item.year ? Number(item.year) : null;
    if (filters.yearFrom != null) {
      if (year == null || year < filters.yearFrom) return false;
    }
    if (filters.yearTo != null) {
      if (year == null || year > filters.yearTo) return false;
    }

    if (filters.hasComment === true && !item.comment?.trim()) return false;
    if (filters.hasComment === false && item.comment?.trim()) return false;

    return true;
  });

  const dir = filters.sortAsc ? 1 : -1;
  filtered.sort((a, b) => {
    switch (filters.sort) {
      case 'title':
        return a.title.localeCompare(b.title, 'cs') * (filters.sortAsc ? 1 : -1);
      case 'userRating': {
        const ar = a.rating ?? -1;
        const br = b.rating ?? -1;
        return (ar - br) * dir;
      }
      case 'tmdbRating': {
        const ar = a.tmdbRating ?? -1;
        const br = b.tmdbRating ?? -1;
        return (ar - br) * dir;
      }
      case 'year': {
        const ay = Number(a.year) || 0;
        const by = Number(b.year) || 0;
        return (ay - by) * dir;
      }
      case 'added':
      default:
        return (a.addedAt > b.addedAt ? 1 : -1) * dir;
    }
  });

  return filtered;
}

export function resetListFilters(): ListFilterState {
  return { ...DEFAULT_LIST_FILTERS };
}
