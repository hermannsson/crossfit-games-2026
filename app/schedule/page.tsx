import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ScheduleView from "@/components/ScheduleView";
import { deriveChrome } from "@/components/shared";
import { getSnapshot, resolveYear } from "@/lib/getSnapshot";
import { COMPETITION_YEARS } from "@/lib/crossfit/competitions";

export const revalidate = 60;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = resolveYear((await searchParams).year);
  const snapshot = await getSnapshot(year);
  const chrome = deriveChrome(snapshot);

  // Past seasons are standings-only — there's no schedule to show.
  if (!chrome.hasSchedule) {
    redirect(year === COMPETITION_YEARS[0] ? "/" : `/?year=${year}`);
  }

  return (
    <>
      <SiteHeader meta={snapshot.meta} chrome={chrome} years={COMPETITION_YEARS} activeYear={year} />
      <main className="wrap">
        <ScheduleView snapshot={snapshot} year={year} />
      </main>
    </>
  );
}
