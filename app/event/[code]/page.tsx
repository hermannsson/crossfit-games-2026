import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import EventView from "@/components/EventView";
import { deriveChrome, withYear } from "@/components/shared";
import { getSnapshot, resolveYear } from "@/lib/getSnapshot";
import { COMPETITION_YEARS } from "@/lib/crossfit/competitions";

export const revalidate = 60;

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { code: rawCode } = await params;
  const year = resolveYear((await searchParams).year);
  const code = rawCode.toUpperCase();

  const snapshot = await getSnapshot(year);
  const known = snapshot.leaderboards.men.columns.some((c) => c.code === code);

  // Unknown event code — fall back to standings rather than 404.
  if (!known) redirect(withYear("/", year));

  return (
    <>
      <SiteHeader meta={snapshot.meta} chrome={deriveChrome(snapshot)} years={COMPETITION_YEARS} activeYear={year} />
      <main className="wrap">
        <EventView snapshot={snapshot} code={code} year={year} />
      </main>
    </>
  );
}
