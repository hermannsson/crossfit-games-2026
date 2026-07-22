"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AthleteRow,
  Division,
  ScheduleEntry,
  Snapshot,
  WorkoutBlock,
} from "@/lib/crossfit/types";

export default function Dashboard({
  snapshot,
  years,
  activeYear,
}: {
  snapshot: Snapshot;
  years: number[];
  activeYear: number;
}) {
  const { meta, leaderboards, schedule, workouts } = snapshot;
  const scored = meta.scored;

  // The current Games publish a CMS schedule + scraped workouts; past seasons
  // are standings-only, so those sections/tabs are hidden when empty.
  const hasSchedule = schedule.length > 0;
  const hasWorkouts = workouts.length > 0;
  const mode: "seeding" | "live" | "final" = !scored
    ? "seeding"
    : /complete|final/i.test(meta.leaderboardMode)
      ? "final"
      : "live";

  const router = useRouter();
  const [division, setDivision] = useState<Division>("men");
  const [view, setView] = useState<string>("Overall");
  const [query, setQuery] = useState("");

  const lb = leaderboards[division];
  const columns = lb.columns;
  const activeCol = columns.find((c) => c.code === view) ?? null;

  // how many events have been scored (0 while seeding)
  const completed = useMemo(() => {
    if (!scored) return 0;
    let max = 0;
    for (const r of lb.rows)
      for (const s of r.scores)
        if (s.place != null && s.ordinal > max) max = s.ordinal;
    return max;
  }, [lb.rows, scored]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base: AthleteRow[];
    if (activeCol) {
      // Event view: order by finish in the selected event, unplaced last.
      base = [...lb.rows].sort((a, b) => placeIn(a, activeCol.ordinal) - placeIn(b, activeCol.ordinal));
    } else if (scored) {
      base = [...lb.rows].sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9));
    } else {
      // seeding: keep the roster order from the API.
      base = [...lb.rows];
    }
    return q ? base.filter((r) => r.name.toLowerCase().includes(q)) : base;
  }, [lb.rows, query, scored, activeCol]);

  const maxPoints = useMemo(
    () => Math.max(1, ...lb.rows.map((r) => r.totalPoints ?? 0)),
    [lb.rows],
  );

  const days = useMemo(() => groupByDay(schedule), [schedule]);

  const nextEvent = schedule[completed] ?? schedule[schedule.length - 1];
  const overallLeader = useMemo(
    () => (scored ? [...lb.rows].sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9)) : lb.rows),
    [lb.rows, scored],
  );
  const leader = overallLeader[0];
  const runnerUp = overallLeader[1];
  const dayKeys = schedule.map((e) => e.dayKey).filter(Boolean).sort();
  // Prefer the accurate per-event day range (current year); fall back to the
  // competition's meta dates for standings-only past seasons.
  const dateRange = dayKeys.length
    ? fmtDateRange(dayKeys[0], dayKeys[dayKeys.length - 1])
    : fmtDateRange(meta.startDate, meta.endDate);

  function changeYear(y: number) {
    router.push(y === years[0] ? "/" : `/?year=${y}`);
  }

  return (
    <>
      {/* ===== TOP BAR ===== */}
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
            <a href="#leaderboard" className="on">Leaderboard</a>
            {hasSchedule && <a href="#schedule">Schedule</a>}
            {hasWorkouts && <a href="#workouts">Workouts</a>}
          </nav>
          <div className="top-spacer" />
          {mode === "live" ? (
            <span className="livepill"><span className="d" />Live</span>
          ) : null}
          <span className="clock mono">{dateRange}</span>
        </div>
      </header>

      <main className="wrap">

        {/* ===== KPI STRIP ===== */}
        <div className="kpis" id="leaderboard">
          <div className="kpi">
            <div className="k">{mode === "final" ? "Champion" : mode === "live" ? "Current Leader" : "Top Seed"}</div>
            <div className="v">
              {leader ? shortName(leader) : "—"}
              {scored && leader?.totalPoints != null && <span className="sm">{leader.totalPoints}</span>}
            </div>
            <div className="s">{leader ? `${leader.countryCode} · ${leader.affiliate || "—"}` : ""}</div>
          </div>
          <div className="kpi">
            <div className="k">Events</div>
            <div className="v">{completed} <span className="sm">/ {columns.length}</span></div>
            <div className="s">{mode === "final" ? "all scored" : scored ? "scored" : "not yet scored"}</div>
          </div>
          {mode !== "final" && hasSchedule ? (
            <div className="kpi">
              <div className="k">Next Event</div>
              <div className="v sm2">{nextEvent?.name ?? "TBA"}</div>
              <div className="s mono">{nextEvent ? `${nextEvent.dayLabel} · ${fmtClock(nextEvent.startTime)} · ${venueShort(nextEvent.venue)}` : ""}</div>
            </div>
          ) : (
            <div className="kpi">
              <div className="k">Runner-up</div>
              <div className="v">
                {runnerUp ? shortName(runnerUp) : "—"}
                {scored && runnerUp?.totalPoints != null && <span className="sm">{runnerUp.totalPoints}</span>}
              </div>
              <div className="s">{runnerUp ? `${runnerUp.countryCode} · ${runnerUp.affiliate || "—"}` : ""}</div>
            </div>
          )}
          {mode === "final" ? (
            <div className="kpi">
              <div className="k">Field</div>
              <div className="v">{lb.totalCompetitors} <span className="sm">athletes</span></div>
              <div className="s">final standings</div>
            </div>
          ) : (
            <div className="kpi">
              <div className="k">Field Cut</div>
              <div className="v">{lb.totalCompetitors} <span className="sm">→ 20</span></div>
              <div className="s">later in competition</div>
            </div>
          )}
        </div>

        {/* ===== TOOLBAR ===== */}
        <div className="toolbar">
          <div className="toolbar-top">
            <div className="seg" role="group" aria-label="Division">
              <button aria-pressed={division === "men"} onClick={() => setDivision("men")}>Men</button>
              <button aria-pressed={division === "women"} onClick={() => setDivision("women")}>Women</button>
            </div>
            <label className="search">
              <span className="mono" aria-hidden>⌕</span>
              <input placeholder="Search athlete…" aria-label="Search athlete"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          <div className="pills" role="group" aria-label="Event view">
            <button className="pill" aria-pressed={!activeCol} onClick={() => setView("Overall")}>Overall</button>
            {columns.map((c) => (
              <button key={c.code} className="pill" aria-pressed={activeCol?.code === c.code}
                onClick={() => setView(c.code)} title={c.name}>{c.code}</button>
            ))}
          </div>
        </div>

        {/* ===== MAIN GRID ===== */}
        <div className="grid solo">
          {/* LEADERBOARD */}
          <div className="card">
            <div className="card-h">
              <h3>{activeCol ? `${activeCol.code} · ${activeCol.name}` : scored ? "Overall Standings" : "Start List"}</h3>
              <span className="meta">{division === "men" ? "Men" : "Women"} · {lb.totalCompetitors} athletes</span>
            </div>
            <div className="tscroll">
              <table className="lb">
                <thead>
                  <tr>
                    <th className="l" style={{ width: 96 }}>{activeCol ? "Finish" : scored ? "Rank" : "Seed"}</th>
                    <th className="l">Athlete</th>
                    {columns.map((c) => (
                      <th key={c.code} title={c.name} className={activeCol?.code === c.code ? "sel" : undefined}>{c.code}</th>
                    ))}
                    <th>{scored ? "Points" : ""}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const eventPlace = activeCol ? placeIn(r, activeCol.ordinal) : Infinity;
                    const pos = activeCol
                      ? (eventPlace < Infinity ? eventPlace : i + 1)
                      : scored && r.rank > 0 ? r.rank : i + 1;
                    return (
                    <tr key={r.name + i} className={pos === 1 ? "r1" : ""}>
                      <td className="l">
                        <div className="rank"><span className="n">{pos}</span></div>
                      </td>
                      <td className="l">
                        <div className="athlete">
                          <Avatar row={r} />
                          <div>
                            <div className="ath">{r.name}<span className="cc">{r.countryCode}</span></div>
                            <div className="aff">{r.affiliate || "—"}</div>
                          </div>
                        </div>
                      </td>
                      {columns.map((c) => {
                        const s = r.scores.find((x) => x.ordinal === c.ordinal);
                        const sel = activeCol?.code === c.code;
                        const title = s ? [s.display, s.points != null ? `${s.points} pts` : ""].filter(Boolean).join(" · ") : undefined;
                        return (
                          <td className={`ev${sel ? " sel" : ""}`} key={c.code} title={title}>
                            {s && s.place != null
                              ? <span className={placeClass(s.place)}>{s.place}</span>
                              : <span className="plc empty">—</span>}
                            {sel && s && s.display ? <span className="evres mono">{s.display}</span> : null}
                          </td>
                        );
                      })}
                      <td className="tot">
                        {scored && r.totalPoints != null ? (
                          <div className="totwrap">
                            <span className="num">{r.totalPoints}</span>
                            <span className="bar"><i style={{ width: `${(r.totalPoints / maxPoints) * 100}%` }} /></span>
                          </div>
                        ) : (
                          <div className="totwrap"><span className="num dim">—</span></div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr className="morerow"><td colSpan={columns.length + 3}>No athletes match “{query}”.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* ===== SCHEDULE ===== */}
        {hasSchedule && (
        <section className="blk" id="schedule">
          <div className="blk-h">
            <h2>Schedule</h2>
            <span className="c mono">{columns.length} events · expand for heat draws</span>
          </div>
          <div className="card sched-scroll">
            <table className="sch">
              <tbody>
                {days.flatMap((d) => [
                  <tr className="dayhdr" key={`${d.key}-hdr`}>
                    <td colSpan={4}>{d.label} — {venueShort(d.venue)}</td>
                  </tr>,
                  ...d.entries.map((e) => <EventRow key={e.order} e={e} />),
                ])}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* ===== WORKOUTS ===== */}
        {hasWorkouts && (
        <section className="blk" id="workouts">
          <div className="blk-h">
            <h2>Workouts</h2>
            <span className="c mono">Individual division · loads ♀ / ♂</span>
          </div>
          <div className="wods">
            {workouts.map((w) => <WorkoutCard key={w.eventId} w={w} />)}
          </div>
        </section>
        )}

        <footer>
          <span className="src">Source · <b>Official CrossFit Games API</b> (c3po.crossfit.com) + workout descriptions</span>
          <span className="src">Snapshot · <b>{fmt(meta.generatedAt)}</b></span>
        </footer>
      </main>
    </>
  );
}

/* ---------- small pieces ---------- */

function EventRow({ e }: { e: ScheduleEntry }) {
  const athletes = e.heats.reduce((n, h) => n + h.lanes.length, 0);
  return (
    <tr>
      <td className="tm">{fmtRange(e.startTime, e.endTime)}</td>
      <td className="code">{e.codeLabel}</td>
      <td>
        <div className="nm">{e.name}{e.kicker && <span className="kick">{e.kicker}</span>}</div>
        {e.heats.length > 0 && (
          <details className="heats">
            <summary>{e.heats.length} heat{e.heats.length === 1 ? "" : "s"} · {athletes} athletes</summary>
            <div className="heatgrid">
              {e.heats.map((h, i) => (
                <div className="heat" key={i}>
                  <div className="heat-h">Heat {h.number} · {h.gender}</div>
                  <ol className="lanes">
                    {h.lanes.map((l) => (
                      <li key={l.lane}><b>{l.lane}</b>{l.name}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        )}
      </td>
      <td className="ven">{venueShort(e.venue)}</td>
    </tr>
  );
}

function WorkoutCard({ w }: { w: WorkoutBlock }) {
  return (
    <div className="wod">
      <div className="top"><span className="code">{w.code}</span><span className="tag">{w.dayLabel}</span></div>
      <h4>{w.name}</h4>
      <div className="lines">
        {w.description.map((line, i) => {
          const cls = /^[♀♂]/.test(line) ? "load" : /(:$|^then,?$)/i.test(line) ? "step" : "";
          return <div key={i} className={cls}>{line}</div>;
        })}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

interface DayGroup {
  key: string;
  label: string;
  short: string;
  venue: string;
  entries: ScheduleEntry[];
}

function groupByDay(schedule: ScheduleEntry[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const e of schedule) {
    if (!map.has(e.dayKey)) {
      map.set(e.dayKey, {
        key: e.dayKey,
        label: e.dayLabel,
        short: (e.dayLabel.match(/(\d+)\s*$/)?.[1]) ?? e.dayLabel,
        venue: e.venue,
        entries: [],
      });
    }
    map.get(e.dayKey)!.entries.push(e);
  }
  return [...map.values()];
}

function shortName(r: AthleteRow): string {
  return r.lastName || r.name;
}

// Finishing place in a given event ordinal; Infinity sorts unplaced athletes
// to the bottom of an event view.
function placeIn(r: AthleteRow, ordinal: number): number {
  const s = r.scores.find((x) => x.ordinal === ordinal);
  return s && s.place != null ? s.place : Infinity;
}

function Avatar({ row }: { row: AthleteRow }) {
  if (row.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={row.photo} alt="" />;
  }
  const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase();
  return <div className="avatar ph">{initials || "—"}</div>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDateRange(a?: string, b?: string): string {
  if (!a) return "July 2026";
  const da = new Date(a);
  const db = b ? new Date(b) : da;
  const mo = MONTHS[da.getUTCMonth()];
  const d1 = da.getUTCDate();
  const d2 = db.getUTCDate();
  const y = da.getUTCFullYear();
  return d1 === d2 ? `${mo} ${d1}, ${y}` : `${mo} ${d1}–${d2}, ${y}`;
}

function placeClass(place: number): string {
  if (place === 1) return "plc p1";
  if (place <= 3) return "plc p2";
  if (place > 10) return "plc plow";
  return "plc";
}

// Times are stored as wall-clock in +00:00, so format from UTC parts.
function fmtClock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtRange(a: string | null, b: string | null): string {
  const s = fmtClock(a), e = fmtClock(b);
  return e ? `${s} – ${e}` : s;
}
function venueShort(v: string): string {
  return v.split("|")[0].trim();
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
