"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Meta } from "@/lib/crossfit/types";
import type { Chrome } from "./shared";

// Shared top bar. Nav links route to the three pages (/, /schedule,
// /workouts); the active tab is derived from the current path. The year
// selector preserves the current page while swapping the ?year query.
export default function SiteHeader({
  meta,
  chrome,
  years,
  activeYear,
}: {
  meta: Meta;
  chrome: Chrome;
  years: number[];
  activeYear: number;
}) {
  const { mode, hasSchedule, hasWorkouts, dateRange } = chrome;
  const router = useRouter();
  const pathname = usePathname();

  // Append ?year only for non-default seasons, matching the original URLs.
  const withYear = (path: string) =>
    activeYear === years[0] ? path : `${path}?year=${activeYear}`;

  function changeYear(y: number) {
    const path = pathname === "/" ? "/" : pathname;
    router.push(y === years[0] ? path : `${path}?year=${y}`);
  }

  return (
    <header className="top">
      <div className="wrap topbar">
        <div className="logo">
          <span className="mk" role="img" aria-label="Kettlebell">
            <svg viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="20.5" r="8.2" fill="currentColor" />
              <path d="M9 15.5C8 5.5 24 5.5 23 15.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            </svg>
          </span>CrossFit Games <span className="yr">{meta.year}</span>
        </div>
        {mode === "seeding" && <span className="seedtag">Seeding</span>}
        {mode === "final" && <span className="seedtag done">Final</span>}
        <label className="yearsel">
          <select
            aria-label="Games year"
            value={activeYear}
            onChange={(e) => changeYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y} Games</option>
            ))}
          </select>
        </label>
        <nav className="tabs">
          <Link href={withYear("/")} className={pathname === "/" ? "on" : undefined}>Leaderboard</Link>
          {hasSchedule && <Link href={withYear("/schedule")} className={pathname === "/schedule" ? "on" : undefined}>Schedule</Link>}
          {hasWorkouts && <Link href={withYear("/workouts")} className={pathname === "/workouts" ? "on" : undefined}>Workouts</Link>}
        </nav>
        <div className="top-spacer" />
        {mode === "live" ? (
          <span className="livepill"><span className="d" />Live</span>
        ) : null}
        <span className="clock mono">{dateRange}</span>
      </div>
    </header>
  );
}
