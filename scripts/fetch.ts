// One-shot data pull. Run with `npm run fetch`.
// Writes JSON snapshots to /data — used as the deploy-time fallback and for
// offline/local viewing. (The deployed site fetches live via ISR.)

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildSnapshot } from "../lib/snapshot";

const DATA_DIR = join(process.cwd(), "data");

async function write(name: string, data: unknown) {
  await writeFile(join(DATA_DIR, name), JSON.stringify(data, null, 2), "utf8");
  console.log(`  ✓ data/${name}`);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  console.log("Pulling 2026 CrossFit Games data …\n");

  const snap = await buildSnapshot();
  console.log(`  competition ${snap.meta.competitionId} · mode "${snap.meta.leaderboardMode}"`);

  await write("meta.json", snap.meta);
  await write("leaderboard-men.json", snap.leaderboards.men);
  await write("leaderboard-women.json", snap.leaderboards.women);
  await write("schedule.json", snap.schedule);
  await write("workouts.json", snap.workouts);

  const heats = snap.schedule.reduce((n, e) => n + e.heats.length, 0);
  console.log(
    `\nDone. ${snap.leaderboards.men.rows.length} men, ${snap.leaderboards.women.rows.length} women, ` +
      `${snap.schedule.length} events (${heats} heats), ${snap.workouts.length} workouts. ` +
      `Scored: ${snap.meta.scored ? "yes" : "not yet (seeding)"}.`,
  );
}

main().catch((e) => {
  console.error("\nfetch failed:", e);
  process.exit(1);
});
