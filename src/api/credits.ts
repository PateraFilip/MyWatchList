import type { PersonRef, TmdbCredits, TmdbMovieDetails, TmdbTvDetails } from '@/src/types';

const CREW_JOBS = new Set([
  'Director',
  'Writer',
  'Screenplay',
  'Novel',
  'Story',
  'Creator',
  'Executive Producer',
  'Producer',
  'Original Music Composer',
  'Director of Photography',
]);

export function extractCast(credits?: TmdbCredits | null, limit = 20): PersonRef[] {
  if (!credits?.cast?.length) return [];
  return credits.cast.slice(0, limit).map((c) => ({
    id: c.id,
    name: c.name,
    profilePath: c.profile_path,
    character: c.character || c.roles?.[0]?.character,
  }));
}

export function extractDirectors(credits?: TmdbCredits | null): PersonRef[] {
  if (!credits?.crew?.length) return [];
  const directors = credits.crew.filter((c) => c.job === 'Director');
  const unique = new Map<number, PersonRef>();
  for (const d of directors) {
    if (!unique.has(d.id)) {
      unique.set(d.id, {
        id: d.id,
        name: d.name,
        profilePath: d.profile_path,
        job: d.job,
      });
    }
  }
  return Array.from(unique.values());
}

export function extractKeyCrew(credits?: TmdbCredits | null, limit = 16): PersonRef[] {
  if (!credits?.crew?.length) return [];
  const unique = new Map<number, PersonRef>();
  const prioritized = credits.crew.filter((c) => CREW_JOBS.has(c.job));
  for (const c of prioritized) {
    if (!unique.has(c.id)) {
      unique.set(c.id, {
        id: c.id,
        name: c.name,
        profilePath: c.profile_path,
        job: c.job,
      });
    }
    if (unique.size >= limit) break;
  }
  return Array.from(unique.values());
}

export function creditsFromMovie(details: TmdbMovieDetails) {
  const credits = details.credits;
  return {
    cast: extractCast(credits),
    directors: extractDirectors(credits),
    creators: [] as PersonRef[],
    keyCrew: extractKeyCrew(credits),
  };
}

export function creditsFromTv(details: TmdbTvDetails) {
  const credits = details.aggregate_credits || details.credits;
  const creators =
    details.created_by?.map((c) => ({
      id: c.id,
      name: c.name,
      profilePath: c.profile_path,
      job: 'Creator',
    })) ?? [];
  return {
    cast: extractCast(credits),
    directors: extractDirectors(credits),
    creators,
    keyCrew: extractKeyCrew(credits),
  };
}
