// Presentation helpers and small UI pieces shared across the Leaderboard,
// Schedule, and Workouts pages. Split out of the former single-page Dashboard
// so each route can render the same chrome and formatting.

import type { AthleteRow, ScheduleEntry, Snapshot } from "@/lib/crossfit/types";

export type Mode = "seeding" | "live" | "final";

export interface Chrome {
  mode: Mode;
  hasSchedule: boolean;
  hasWorkouts: boolean;
  dateRange: string;
}

// Derive the values the top bar and KPI strip need from a snapshot. Kept pure
// so it can run in the server components that back each route.
export function deriveChrome(snapshot: Snapshot): Chrome {
  const { meta, schedule, workouts } = snapshot;
  const mode: Mode = !meta.scored
    ? "seeding"
    : /complete|final/i.test(meta.leaderboardMode)
      ? "final"
      : "live";

  const dayKeys = schedule.map((e) => e.dayKey).filter(Boolean).sort();
  // Prefer the accurate per-event day range (current year); fall back to the
  // competition's meta dates for standings-only past seasons.
  const dateRange = dayKeys.length
    ? fmtDateRange(dayKeys[0], dayKeys[dayKeys.length - 1])
    : fmtDateRange(meta.startDate, meta.endDate);

  return {
    mode,
    hasSchedule: schedule.length > 0,
    hasWorkouts: workouts.length > 0,
    dateRange,
  };
}

/* ---------- schedule grouping ---------- */

export interface DayGroup {
  key: string;
  label: string;
  short: string;
  venue: string;
  entries: ScheduleEntry[];
}

export function groupByDay(schedule: ScheduleEntry[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const e of schedule) {
    if (!map.has(e.dayKey)) {
      map.set(e.dayKey, {
        key: e.dayKey,
        label: e.dayLabel,
        short: (e.dayLabel.match(/(\d+)\s*$/)?.[1]) ?? e.dayLabel,
        venue: e.venue,
        entries: [],
      });
    }
    map.get(e.dayKey)!.entries.push(e);
  }
  return [...map.values()];
}

/* ---------- athletes ---------- */

export function shortName(r: AthleteRow): string {
  return r.lastName || r.name;
}

// Finishing place in a given event ordinal; Infinity sorts unplaced athletes
// to the bottom of an event view.
export function placeIn(r: AthleteRow, ordinal: number): number {
  const s = r.scores.find((x) => x.ordinal === ordinal);
  return s && s.place != null ? s.place : Infinity;
}

export function placeClass(place: number): string {
  if (place === 1) return "plc p1";
  if (place <= 3) return "plc p2";
  if (place > 10) return "plc plow";
  return "plc";
}

export function Avatar({ row }: { row: AthleteRow }) {
  if (row.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={row.photo} alt="" />;
  }
  const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase();
  return <div className="avatar ph">{initials || "—"}</div>;
}

/* ---------- dates & times ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDateRange(a?: string, b?: string): string {
  if (!a) return "July 2026";
  const da = new Date(a);
  const db = b ? new Date(b) : da;
  const mo = MONTHS[da.getUTCMonth()];
  const d1 = da.getUTCDate();
  const d2 = db.getUTCDate();
  const y = da.getUTCFullYear();
  return d1 === d2 ? `${mo} ${d1}, ${y}` : `${mo} ${d1}–${d2}, ${y}`;
}

// Times are stored as wall-clock in +00:00, so format from UTC parts.
export function fmtClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export function fmtRange(a: string | null, b: string | null): string {
  const s = fmtClock(a), e = fmtClock(b);
  return e ? `${s} – ${e}` : s;
}

export function venueShort(v: string): string {
  return v.split("|")[0].trim();
}
