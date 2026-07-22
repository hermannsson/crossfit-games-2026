import { buildSnapshot } from "@/lib/snapshot";
import { loadSnapshot } from "@/lib/data";
import { COMPETITION_YEARS, DEFAULT_YEAR, getCompetition } from "@/lib/crossfit/competitions";
import type { Snapshot } from "@/lib/crossfit/types";

// Resolve the requested ?year to a valid competition year.
export function resolveYear(raw: string | undefined): number {
  const requested = Number(raw);
  return COMPETITION_YEARS.includes(requested) ? requested : DEFAULT_YEAR;
}

// Load the snapshot for a year, falling back to the committed snapshot when the
// live API is unreachable. Shared by every page route so the fetch (cached
// under tag "cf-data") is reused across them.
export async function getSnapshot(year: number): Promise<Snapshot> {
  try {
    return await buildSnapshot(year);
  } catch {
    // Live API unreachable — serve the committed snapshot (current year only).
    return getCompetition(year).current
      ? await loadSnapshot()
      : await buildSnapshot(DEFAULT_YEAR).catch(() => loadSnapshot());
  }
}
