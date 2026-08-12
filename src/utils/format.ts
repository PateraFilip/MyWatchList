import type { MediaType, WatchItem } from '@/src/types';

export function mediaTypeLabel(type: MediaType): string {
  return type === 'movie' ? 'Film' : 'Seriál';
}

export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function tvProgressLabel(item: WatchItem): string | null {
  if (item.mediaType !== 'tv') return null;
  const seasons = Object.values(item.seasons);
  if (seasons.length === 0) return null;
  let watched = 0;
  let planned = 0;
  seasons.forEach((s) => {
    Object.values(s.episodes || {}).forEach((st) => {
      if (st === 'watched') watched += 1;
      else if (st === 'watchlist') planned += 1;
    });
  });
  if (watched === 0 && planned === 0) return null;
  if (planned > 0 && watched > 0) return `${watched} zhl. · ${planned} plán`;
  if (planned > 0) return `${planned} plán`;
  return `${watched} ep.`;
}

export function relativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'dnes';
  if (days === 1) return 'včera';
  if (days < 7) return `před ${days} dny`;
  return date.toLocaleDateString('cs-CZ');
}

/** Formát YYYY-MM-DD → např. 15. 3. 2026 */
export function formatPremiereDate(isoDate: string | null | undefined): string | null {
  if (!isoDate || isoDate.length < 4) return null;
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

export function premiereLabel(
  isoDate: string | null | undefined,
  kind: 'movie' | 'tv' | 'season' | 'episode' = 'movie'
): string | null {
  const formatted = formatPremiereDate(isoDate);
  if (!formatted) return null;
  if (kind === 'tv') return `Premiéra: ${formatted}`;
  if (kind === 'season') return `Premiéra série: ${formatted}`;
  if (kind === 'episode') return `Vysílání: ${formatted}`;
  return `Vydání: ${formatted}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD as local noon timestamp */
export function parseIsoDate(isoDate: string | null | undefined): number | null {
  if (!isoDate || isoDate.length < 4) return null;
  const t = new Date(`${isoDate.slice(0, 10)}T12:00:00`).getTime();
  return Number.isNaN(t) ? null : t;
}

export function isReleaseOut(isoDate: string | null | undefined, now = Date.now()): boolean {
  const t = parseIsoDate(isoDate);
  if (t == null) return false;
  return t <= now;
}

/** Datum není starší než `days` dní (budoucí data procházejí). */
export function isWithinLastDays(
  isoDate: string | null | undefined,
  days: number,
  now = Date.now()
): boolean {
  const t = parseIsoDate(isoDate);
  if (t == null) return false;
  if (t > now) return true;
  return now - t <= days * DAY_MS;
}

/** Novinka max. měsíc stará (podle releaseDate, jinak createdAt). Budoucí premiéry nechá. */
export function isNotificationRelevant(
  n: { releaseDate?: string | null; createdAt: string },
  days = 30,
  now = Date.now()
): boolean {
  if (n.releaseDate) return isWithinLastDays(n.releaseDate, days, now);
  const created = new Date(n.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created <= days * DAY_MS;
}

