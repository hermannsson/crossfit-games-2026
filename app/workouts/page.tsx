import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import WorkoutsView from "@/components/WorkoutsView";
import { deriveChrome } from "@/components/shared";
import { getSnapshot, resolveYear } from "@/lib/getSnapshot";
import { COMPETITION_YEARS } from "@/lib/crossfit/competitions";

export const revalidate = 60;

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = resolveYear((await searchParams).year);
  const snapshot = await getSnapshot(year);
  const chrome = deriveChrome(snapshot);

  // Workout descriptions are only scraped for the current Games.
  if (!chrome.hasWorkouts) {
    redirect(year === COMPETITION_YEARS[0] ? "/" : `/?year=${year}`);
  }

  return (
    <>
      <SiteHeader meta={snapshot.meta} chrome={chrome} years={COMPETITION_YEARS} activeYear={year} />
      <main className="wrap">
        <WorkoutsView snapshot={snapshot} year={year} />
      </main>
    </>
  );
}
