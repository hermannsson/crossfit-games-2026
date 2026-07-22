import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import AthleteView from "@/components/AthleteView";
import { athleteSlug, deriveChrome, withYear } from "@/components/shared";
import { getSnapshot, resolveYear } from "@/lib/getSnapshot";
import { COMPETITION_YEARS } from "@/lib/crossfit/competitions";
import type { Division } from "@/lib/crossfit/types";

export const revalidate = 60;

export default async function AthletePage({
  params,
  searchParams,
}: {
  params: Promise<{ division: string; slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { division: rawDivision, slug } = await params;
  const year = resolveYear((await searchParams).year);
  const division: Division = rawDivision === "women" ? "women" : "men";

  const snapshot = await getSnapshot(year);
  const row = snapshot.leaderboards[division].rows.find((r) => athleteSlug(r) === slug);

  // Unknown athlete (e.g. after switching to a season they didn't compete in):
  // fall back to the standings rather than 404.
  if (!row) redirect(withYear("/", year));

  return (
    <>
      <SiteHeader meta={snapshot.meta} chrome={deriveChrome(snapshot)} years={COMPETITION_YEARS} activeYear={year} />
      <main className="wrap">
        <AthleteView snapshot={snapshot} division={division} row={row} year={year} />
      </main>
    </>
  );
}
