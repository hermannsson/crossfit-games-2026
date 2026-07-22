import { buildSnapshot } from "@/lib/snapshot";
import { loadSnapshot } from "@/lib/data";
import Dashboard from "@/components/Dashboard";
import type { Snapshot } from "@/lib/crossfit/types";

// Rebuild the cached page from live data at most once per minute (ISR). The
// per-fetch cache (tag "cf-data") aligns with this and can be busted early via
// /api/refresh. Individual fetches falling back keeps a partial outage graceful.
export const revalidate = 60;

export default async function Page() {
  let snapshot: Snapshot;
  try {
    snapshot = await buildSnapshot();
  } catch {
    // Live API unreachable — serve the committed snapshot instead of erroring.
    snapshot = await loadSnapshot();
  }
  return <Dashboard snapshot={snapshot} />;
}
