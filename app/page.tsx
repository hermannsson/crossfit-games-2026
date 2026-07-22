import SiteHeader from "@/components/SiteHeader";
import LeaderboardView from "@/components/LeaderboardView";
import { deriveChrome } from "@/components/shared";
import { getSnapshot, resolveYear } from "@/lib/getSnapshot";
import { COMPETITION_YEARS } from "@/lib/crossfit/competitions";

// Rebuild the cached page from live data at most once per minute (ISR). The
// per-fetch cache (tag "cf-data") aligns with this and can be busted early via
// /api/refresh. Individual fetches falling back keeps a partial outage graceful.
export const revalidate = 60;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = resolveYear((await searchParams).year);
  const snapshot = await getSnapshot(year);

  return (
    <>
      <SiteHeader meta={snapshot.meta} chrome={deriveChrome(snapshot)} years={COMPETITION_YEARS} activeYear={year} />
      <main className="wrap">
        <LeaderboardView snapshot={snapshot} year={year} />
      </main>
    </>
  );
}
