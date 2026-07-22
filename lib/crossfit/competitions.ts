// The set of Games seasons the site can display. Each maps a year to the
// identifiers the c3po API keys competitions by. The leaderboard is available
// for every listed year; the CMS schedule and scraped workout descriptions are
// only published for the *current* Games, so past years render standings-first
// (see buildSnapshot). Add a new season by prepending an entry here.

export interface CompetitionConfig {
  year: number;
  /** leaderboard `final=` id (competition id) */
  finalId: number;
  /** leaderboard path segment, e.g. "finals/2026" */
  compSlug: string;
  /** metadata slug, e.g. "games/2026" */
  metaSlug: string;
  /**
   * The live/upcoming Games. Only the current season has a CMS schedule (real
   * times/venues) and a scraped workouts page; past seasons are standings-only.
   */
  current: boolean;
}

// Newest first — the first entry is the default the homepage shows.
export const COMPETITIONS: CompetitionConfig[] = [
  { year: 2026, finalId: 261, compSlug: "finals/2026", metaSlug: "games/2026", current: true },
  { year: 2025, finalId: 245, compSlug: "finals/2025", metaSlug: "games/2025", current: false },
];

export const DEFAULT_YEAR = COMPETITIONS[0].year;

export const COMPETITION_YEARS = COMPETITIONS.map((c) => c.year);

export function getCompetition(year: number | undefined): CompetitionConfig {
  return COMPETITIONS.find((c) => c.year === year) ?? COMPETITIONS[0];
}
