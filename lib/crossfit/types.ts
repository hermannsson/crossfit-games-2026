// Shared data shapes consumed by the site. The fetch script (scripts/fetch.ts)
// transforms the raw CrossFit API / scraped HTML into these.

export type Division = "men" | "women";

export interface Meta {
  competitionId: number; // 261
  identifier: string; // e.g. 4c38d4136f0a5c9ee638
  name: string; // "CrossFit Games"
  year: number;
  startDate: string; // ISO
  endDate: string; // ISO
  /** "registration" | "live" | "finalized" — from the API's leaderboard_mode */
  leaderboardMode: string;
  /** true once at least one event has scores posted */
  scored: boolean;
  generatedAt: string; // ISO — when this snapshot was pulled
}

export interface EventScore {
  /** 1-based event ordinal matching a leaderboard column */
  ordinal: number;
  /** finishing place in that event, if scored */
  place: number | null;
  /** points awarded, if scored */
  points: number | null;
  /** raw human-readable result, e.g. "3:42" or "225 lb" */
  display: string;
}

export interface AthleteRow {
  rank: number; // overall rank (or seed before scoring)
  name: string;
  firstName: string;
  lastName: string;
  countryCode: string; // e.g. USA, NZL
  country: string;
  region: string;
  affiliate: string;
  gender: Division;
  /** athlete headshot URL, if available */
  photo: string;
  /** total competition points, null before scoring */
  totalPoints: number | null;
  /** per-event scores keyed by ordinal (only present once scored) */
  scores: EventScore[];
}

export interface LeaderboardColumn {
  ordinal: number;
  code: string; // e.g. "IE1"
  name: string; // e.g. "The 2007 Hopper"
}

export interface Leaderboard {
  division: Division;
  columns: LeaderboardColumn[];
  rows: AthleteRow[];
  totalCompetitors: number;
}

export interface HeatLane {
  lane: number;
  name: string;
}

export interface Heat {
  number: number;
  gender: string; // "Men" | "Women"
  lanes: HeatLane[];
}

export interface ScheduleEntry {
  order: number; // position in overall competition order
  codeLabel: string; // "IE1", "IE3–5", or ""
  codes: string[]; // ["IE1"] or ["IE3","IE4","IE5"]
  name: string;
  kicker: string; // "Women, Men" or ""
  dayKey: string; // "2026-07-22"
  dayLabel: string; // "Wed · Jul 22"
  daySection: string; // "Wednesday"
  startTime: string | null; // ISO (wall-clock in +00:00)
  endTime: string | null;
  venue: string; // "Morgan Hill | The Ranch"
  heats: Heat[];
}

export interface WorkoutBlock {
  code: string; // "IE1" if we can map it, else ""
  eventId: string; // data-id from the site
  name: string;
  dayLabel: string; // "July 22"
  dayKey: string; // "wednesdayjuly22"
  description: string[]; // paragraph lines
}

export interface Snapshot {
  meta: Meta;
  leaderboards: Record<Division, Leaderboard>;
  schedule: ScheduleEntry[];
  workouts: WorkoutBlock[];
}
