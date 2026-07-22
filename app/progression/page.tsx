import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ProgressionView from "@/components/ProgressionView";
import { deriveChrome } from "@/components/shared";
import { getSnapshot, resolveYear } from "@/lib/getSnapshot";
import { COMPETITION_YEARS } from "@/lib/crossfit/competitions";

export const revalidate = 60;

export default async function ProgressionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = resolveYear((await searchParams).year);
  const snapshot = await getSnapshot(year);
  const chrome = deriveChrome(snapshot);

  // The bump chart needs at least two scored events to trace movement.
  if (!chrome.hasProgression) {
    redirect(year === COMPETITION_YEARS[0] ? "/" : `/?year=${year}`);
  }

  return (
    <>
      <SiteHeader meta={snapshot.meta} chrome={chrome} years={COMPETITION_YEARS} activeYear={year} />
      <main className="wrap">
        <ProgressionView snapshot={snapshot} year={year} />
      </main>
    </>
  );
}
