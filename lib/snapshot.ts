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

  // Workouts (scraped HTML) and the CMS schedule are only published for the
  // current Games; past seasons render standings-first from the leaderboard.
  const [menRaw, womenRaw, workouts, schedule] = await Promise.all([
    fetchLeaderboard(comp, "men"),
    fetchLeaderboard(comp, "women"),
    comp.current
      ? fetchWorkouts().catch(() => [] as WorkoutBlock[])
      : Promise.resolve([] as WorkoutBlock[]),
    comp.current
      ? fetchSchedule(meta.identifier).catch(() => [] as ScheduleEntry[])
      : Promise.resolve([] as ScheduleEntry[]),
  ]);

  // Prefer named columns from the workouts source; fall back to the bare event
  // columns the leaderboard itself reports (used for past seasons).
  const columns: LeaderboardColumn[] = workouts.length
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
