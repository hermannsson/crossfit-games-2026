// Reads the JSON snapshot written by `npm run fetch`. Server-side only.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Leaderboard,
  Meta,
  ScheduleEntry,
  Snapshot,
  WorkoutBlock,
} from "./crossfit/types";

const DIR = join(process.cwd(), "data");

async function read<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(DIR, name), "utf8")) as T;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [meta, men, women, schedule, workouts] = await Promise.all([
    read<Meta>("meta.json"),
    read<Leaderboard>("leaderboard-men.json"),
    read<Leaderboard>("leaderboard-women.json"),
    read<ScheduleEntry[]>("schedule.json"),
    read<WorkoutBlock[]>("workouts.json"),
  ]);
  return { meta, leaderboards: { men, women }, schedule, workouts };
}
