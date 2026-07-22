// One-shot data pull. Run with `npm run fetch`.
// Writes JSON snapshots to /data that the site reads at request time.

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  fetchMeta,
  fetchLeaderboard,
  fetchSchedule,
} from "../lib/crossfit/api";
import { fetchWorkouts } from "../lib/crossfit/workouts";
import type {
  Division,
  Leaderboard,
  LeaderboardColumn,
  ScheduleEntry,
  WorkoutBlock,
} from "../lib/crossfit/types";

const DATA_DIR = join(process.cwd(), "data");

async function write(name: string, data: unknown) {
  await writeFile(join(DATA_DIR, name), JSON.stringify(data, null, 2), "utf8");
  console.log(`  ✓ data/${name}`);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  console.log("Pulling 2026 CrossFit Games data from c3po.crossfit.com …\n");

  const meta = await fetchMeta();
  console.log(`  competition ${meta.competitionId} · mode "${meta.leaderboardMode}"`);

  const [menRaw, womenRaw, workouts, schedule] = await Promise.all([
    fetchLeaderboard("men"),
    fetchLeaderboard("women"),
    fetchWorkouts().catch((e) => {
      console.warn(`  ! workouts scrape failed: ${e.message}`);
      return [] as WorkoutBlock[];
    }),
    fetchSchedule(meta.identifier).catch((e) => {
      console.warn(`  ! schedule fetch failed: ${e.message}`);
      return [] as ScheduleEntry[];
    }),
  ]);

  // Leaderboard event columns: the named marquee workouts.
  const columns: LeaderboardColumn[] = workouts.map((w, i) => ({
    ordinal: i + 1,
    code: w.code,
    name: w.name,
  }));

  const anyScored =
    menRaw.rows.some((r) => r.scores.length > 0) ||
    womenRaw.rows.some((r) => r.scores.length > 0);
  meta.scored = anyScored;

  const leaderboards: Record<Division, Leaderboard> = {
    men: { division: "men", columns, rows: menRaw.rows, totalCompetitors: menRaw.totalCompetitors },
    women: { division: "women", columns, rows: womenRaw.rows, totalCompetitors: womenRaw.totalCompetitors },
  };

  const totalHeats = schedule.reduce((n, e) => n + e.heats.length, 0);

  await write("meta.json", meta);
  await write("leaderboard-men.json", leaderboards.men);
  await write("leaderboard-women.json", leaderboards.women);
  await write("schedule.json", schedule);
  await write("workouts.json", workouts);

  console.log(
    `\nDone. ${menRaw.rows.length} men, ${womenRaw.rows.length} women, ` +
      `${schedule.length} scheduled events (${totalHeats} heats), ` +
      `${workouts.length} workouts. Scored: ${anyScored ? "yes" : "not yet (seeding)"}.`,
  );
}

main().catch((e) => {
  console.error("\nfetch failed:", e);
  process.exit(1);
});
