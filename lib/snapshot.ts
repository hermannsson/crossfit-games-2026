// Builds a full data snapshot in-memory from the live CrossFit APIs.
// Shared by the site (server component, cached via ISR) and the local
// one-shot script (scripts/fetch.ts, which also writes it to /data).

import { fetchMeta, fetchLeaderboard, fetchSchedule } from "./crossfit/api";
import { fetchWorkouts } from "./crossfit/workouts";
import type {
  Division,
  Leaderboard,
  LeaderboardColumn,
  ScheduleEntry,
  Snapshot,
  WorkoutBlock,
} from "./crossfit/types";

export async function buildSnapshot(): Promise<Snapshot> {
  const meta = await fetchMeta();

  const [menRaw, womenRaw, workouts, schedule] = await Promise.all([
    fetchLeaderboard("men"),
    fetchLeaderboard("women"),
    fetchWorkouts().catch(() => [] as WorkoutBlock[]),
    fetchSchedule(meta.identifier).catch(() => [] as ScheduleEntry[]),
  ]);

  const columns: LeaderboardColumn[] = workouts.map((w, i) => ({
    ordinal: i + 1,
    code: w.code,
    name: w.name,
  }));

  meta.scored =
    menRaw.rows.some((r) => r.scores.length > 0) ||
    womenRaw.rows.some((r) => r.scores.length > 0);

  const leaderboards: Record<Division, Leaderboard> = {
    men: { division: "men", columns, rows: menRaw.rows, totalCompetitors: menRaw.totalCompetitors },
    women: { division: "women", columns, rows: womenRaw.rows, totalCompetitors: womenRaw.totalCompetitors },
  };

  return { meta, leaderboards, schedule, workouts };
}
