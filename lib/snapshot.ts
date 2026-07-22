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

  // During the current Games the CMS schedule is the authoritative event slate
  // (every IE code across the competition), while the workouts feed only carries
  // the events whose descriptions have been released so far. Derive the
  // scoreboard columns from the schedule so the leaderboard, filter, KPI and
  // schedule all agree on the same set of events — named where announced,
  // "Event N" placeholders otherwise. Past seasons have no schedule, so fall
  // back to the workouts source and finally the bare leaderboard columns.
  const columns: LeaderboardColumn[] = schedule.length
    ? columnsFromSchedule(schedule)
    : workouts.length
      ? workouts.map((w, i) => ({ ordinal: i + 1, code: w.code, name: w.name }))
      : menRaw.columns.length
        ? menRaw.columns
        : womenRaw.columns;

  meta.scored =
    menRaw.rows.some((r) => r.scores.length > 0) ||
    womenRaw.rows.some((r) => r.scores.length > 0);

  const leaderboards: Record<Division, Leaderboard> = {
    men: { division: "men", columns, rows: menRaw.rows, totalCompetitors: menRaw.totalCompetitors },
    women: { division: "women", columns, rows: womenRaw.rows, totalCompetitors: womenRaw.totalCompetitors },
  };

  return { meta, leaderboards, schedule, workouts };
}

// One column per distinct event code in the schedule, ordered by event number.
// Combined schedule rows (e.g. "IE3–5", the three CrossFit Total lifts) expand
// into one column each, since they score as separate events. The ordinal is the
// IE number so per-event scores (keyed by ordinal) line up once scoring begins.
//
// TODO(scoring): this assumes the leaderboard API scores event IEn under
// ordinal n. That holds during seeding (no scores yet), but the schedule has a
// gap (IE7 is absent), so the API may assign sequential ordinals (…IE6=6,
// IE8=7…) and shift everything after the gap. Re-verify the ordinal↔code
// mapping against the live API once real scores start posting, and map by the
// API's ordinals if they diverge from the IE numbers.
function columnsFromSchedule(schedule: ScheduleEntry[]): LeaderboardColumn[] {
  const map = new Map<number, LeaderboardColumn>();
  for (const e of schedule) {
    for (const code of e.codes) {
      const ordinal = Number(code.replace(/\D/g, ""));
      if (!Number.isFinite(ordinal) || map.has(ordinal)) continue;
      map.set(ordinal, { ordinal, code, name: e.name });
    }
  }
  return [...map.values()].sort((a, b) => a.ordinal - b.ordinal);
}
