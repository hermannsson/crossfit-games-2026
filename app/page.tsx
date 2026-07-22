import { buildSnapshot } from "@/lib/snapshot";
import { loadSnapshot } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
import { COMPETITION_YEARS, DEFAULT_YEAR, getCompetition } from "@/lib/crossfit/competitions";
import type { Snapshot } from "@/lib/crossfit/types";

// Rebuild the cached page from live data at most once per minute (ISR). The
// per-fetch cache (tag "cf-data") aligns with this and can be busted early via
// /api/refresh. Individual fetches falling back keeps a partial outage graceful.
export const revalidate = 60;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.year);
  const year = COMPETITION_YEARS.includes(requested) ? requested : DEFAULT_YEAR;

  let snapshot: Snapshot;
  try {
    snapshot = await buildSnapshot(year);
  } catch {
    // Live API unreachable — serve the committed snapshot (current year only).
    snapshot =
      getCompetition(year).current
        ? await loadSnapshot()
        : await buildSnapshot(DEFAULT_YEAR).catch(() => loadSnapshot());
  }
  return <Dashboard snapshot={snapshot} years={COMPETITION_YEARS} activeYear={year} />;
}
