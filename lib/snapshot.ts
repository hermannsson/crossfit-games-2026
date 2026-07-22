// Builds a full data snapshot in-memory from the live CrossFit APIs.
// Shared by the site (server component, cached via ISR) and the local
// one-shot script (scripts/fetch.ts, which also writes it to /data).

import { fetchMeta, fetchLeaderboard, fetchSchedule } from "./crossfit/api";
import { fetchWorkouts } from "./crossfit/workouts";
import { DEFAULT_YEAR, getCompetition } from "./crossfit/competitions";
import type {
  Division,
  Leaderboard,
  LeaderboardColumn,
  ScheduleEntry,
  Snapshot,
  WorkoutBlock,
} from "./crossfit/types";

/** A named event in competition order — the display slate, before scores. */
export interface NamedEvent {
  code: string; // "IE1"
  name: string; // "The 2007 Hopper"
}

export async function buildSnapshot(year: number = DEFAULT_YEAR): Promise<Snapshot> {
  const comp = getCompetition(year);
  const meta = await fetchMeta(comp);

  // Workout descriptions (scraped HTML) are published per-season, so we scrape
  // them for past Games too (comp.compSlug picks the right year). The CMS
  // schedule with real times/venues/heats is only published for the current
  // Games; past seasons render standings-first, named from the workouts feed.
  const [menRaw, womenRaw, workouts, schedule] = await Promise.all([
    fetchLeaderboard(comp, "men"),
    fetchLeaderboard(comp, "women"),
    fetchWorkouts(comp.compSlug).catch(() => [] as WorkoutBlock[]),
    comp.current
      ? fetchSchedule(meta.identifier).catch(() => [] as ScheduleEntry[])
      : Promise.resolve([] as ScheduleEntry[]),
  ]);

  // The display slate: every event in competition order, named where announced.
  // The CMS schedule (current Games) lists the full slate; past seasons fall
  // back to the scraped workouts feed. This supplies names/codes only — the
  // scored ordinal each column matches against comes from the leaderboard API.
  const named = namedEvents(schedule, workouts);

  // The leaderboard API is authoritative for the ordinal a per-event score is
  // keyed by. Join the names onto the API's ordinals by position so the
  // leaderboard, filter, KPI and schedule all agree on one column set that
  // matches scores correctly (see deriveColumns). Men and women run the same
  // slate; use whichever division has published ordinals.
  const columns: LeaderboardColumn[] = deriveColumns(
    named,
    menRaw.columns.length ? menRaw.columns : womenRaw.columns,
  );

  meta.scored =
    menRaw.rows.some((r) => r.scores.length > 0) ||
    womenRaw.rows.some((r) => r.scores.length > 0);

  const leaderboards: Record<Division, Leaderboard> = {
    men: { division: "men", columns, rows: menRaw.rows, totalCompetitors: menRaw.totalCompetitors },
    women: { division: "women", columns, rows: womenRaw.rows, totalCompetitors: womenRaw.totalCompetitors },
  };

  return { meta, leaderboards, schedule, workouts };
}

// The display slate — one entry per distinct event, in competition order.
// Combined schedule rows (e.g. "IE3–5", the three CrossFit Total lifts) expand
// into one entry each, since they score as separate events. Prefer the CMS
// schedule (current Games, full slate); fall back to the scraped workouts feed
// (past seasons). Ordered by IE number, which is competition order.
export function namedEvents(
  schedule: ScheduleEntry[],
  workouts: WorkoutBlock[],
): NamedEvent[] {
  if (schedule.length) {
    const seen = new Set<string>();
    const out: NamedEvent[] = [];
    for (const e of schedule) {
      for (const code of e.codes) {
        if (seen.has(code)) continue;
        seen.add(code);
        out.push({ code, name: e.name });
      }
    }
    return out.sort((a, b) => ieNum(a.code) - ieNum(b.code));
  }
  return workouts.map((w) => ({ code: w.code, name: w.name }));
}

// Build the leaderboard columns by joining event names onto the API's ordinals.
//
// The leaderboard API numbers events sequentially in competition order (1..N)
// and keys every per-event score by that ordinal — it has no concept of the IE
// codes, which live only in the schedule/workouts. The IE codes have a gap
// (IE7 is absent), so keying columns off the IE number would shift every score
// after the gap. Instead we take the ordinal straight from the API and join the
// names positionally: the i-th named event lines up with the API's i-th
// ordinal. This is correct whether the API numbers contiguously (1..N) or
// skips to mirror the IE codes — both drop the same slot at the same position.
//
// Events the API hasn't published an ordinal for yet (still upcoming) get a
// provisional ordinal that continues past the API's highest, so it can never
// collide with a scored event. Those columns have no scores to show anyway, and
// the instant the event is scored its ordinal comes straight from the API.
export function deriveColumns(
  named: NamedEvent[],
  apiOrdinals: LeaderboardColumn[],
): LeaderboardColumn[] {
  const sorted = [...apiOrdinals].sort((a, b) => a.ordinal - b.ordinal);
  // No event names available (past season with no workouts feed): fall back to
  // the leaderboard's own ordinal columns ("Event N" placeholders).
  if (named.length === 0) return sorted;

  const maxApi = sorted.length ? sorted[sorted.length - 1].ordinal : 0;
  return named.map((n, i) => ({
    ordinal: sorted[i]?.ordinal ?? maxApi + 1 + (i - sorted.length),
    code: n.code,
    name: n.name,
  }));
}

function ieNum(code: string): number {
  const n = Number(code.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}
