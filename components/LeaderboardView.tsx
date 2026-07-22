"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AthleteRow, Division, Snapshot } from "@/lib/crossfit/types";
import {
  Avatar,
  athleteHref,
  deriveChrome,
  eventHref,
  fmtClock,
  placeClass,
  placeIn,
  shortName,
  venueShort,
} from "./shared";

// Leaderboard page body: the competition KPI strip plus the division /
// event / search toolbar and the standings table.
export default function LeaderboardView({ snapshot, year }: { snapshot: Snapshot; year: number }) {
  const { meta, leaderboards, schedule } = snapshot;
  const scored = meta.scored;
  const { mode, hasSchedule } = deriveChrome(snapshot);

  const [division, setDivision] = useState<Division>("men");
  const [view, setView] = useState<string>("Overall");
  const [query, setQuery] = useState("");
  // When on, every event column shows its score (time/reps), not just the
  // selected one.
  const [showScores, setShowScores] = useState(false);

  const lb = leaderboards[division];
  const columns = lb.columns;
  const activeCol = columns.find((c) => c.code === view) ?? null;

  // The set of event ordinals that have been scored (empty while seeding). The
  // API ordinals aren't necessarily contiguous, so we track the actual set
  // rather than a max — `completed` is its size (used for the "X / N" KPI).
  const scoredOrdinals = useMemo(() => {
    const set = new Set<number>();
    if (scored)
      for (const r of lb.rows)
        for (const s of r.scores) if (s.place != null) set.add(s.ordinal);
    return set;
  }, [lb.rows, scored]);
  const completed = scoredOrdinals.size;

  // Rank movement caused by the most recent scored event: each athlete's
  // standing from cumulative points through the latest event vs through the one
  // before it (positive = climbed). Only meaningful in the overall view with at
  // least two events scored. Keyed by athlete name (unique within a division).
  const movement = useMemo(() => {
    const map = new Map<string, number>();
    const scoredOrds = [...scoredOrdinals].sort((a, b) => a - b);
    if (scoredOrds.length < 2) return map;
    const latest = scoredOrds[scoredOrds.length - 1];
    const inScored = scoredOrdinals;

    const sum = (r: AthleteRow, skipLatest: boolean) =>
      r.scores.reduce(
        (t, s) =>
          s.points != null &&
          inScored.has(s.ordinal) &&
          !(skipLatest && s.ordinal === latest)
            ? t + s.points
            : t,
        0,
      );

    const nowPts = lb.rows.map((r) => sum(r, false));
    const prevPts = lb.rows.map((r) => sum(r, true));
    // Standard competition ranking (ties share a rank): 1 + (# strictly above).
    const rankOf = (pts: number[], v: number) => 1 + pts.filter((p) => p > v).length;

    lb.rows.forEach((r, i) => {
      map.set(r.name, rankOf(prevPts, prevPts[i]) - rankOf(nowPts, nowPts[i]));
    });
    return map;
  }, [lb.rows, scoredOrdinals]);

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

  // Fixed table layout: rank/athlete/points get set widths, the event columns
  // split the rest evenly. The table's min-width scales with the event count
  // (and grows when scores are shown) so many events scroll instead of cramming.
  const eventMin = showScores ? 92 : 60;
  const tableMinWidth = 96 + 260 + 132 + columns.length * eventMin;

  // The next event to be contested: the first column (in competition order) not
  // yet scored, mapped back to its schedule row for day/time/venue. Resolving
  // via the event code — not a positional index — keeps it correct across
  // combined rows (IE3–5) and gaps (IE7), which don't line up 1:1 with columns.
  const nextCol = columns.find((c) => !scoredOrdinals.has(c.ordinal));
  const nextEvent =
    (nextCol && schedule.find((e) => e.codes.includes(nextCol.code))) ??
    schedule[schedule.length - 1];
  const overallLeader = useMemo(
    () => (scored ? [...lb.rows].sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9)) : lb.rows),
    [lb.rows, scored],
  );
  const leader = overallLeader[0];
  const runnerUp = overallLeader[1];

  return (
    <>
      {/* ===== KPI STRIP ===== */}
      <div className="kpis">
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
        <div className="kpi">
          <div className="k">Field</div>
          <div className="v">{lb.totalCompetitors} <span className="sm">athletes</span></div>
          <div className="s">{mode === "final" ? "final standings" : mode === "live" ? "in competition" : "start list"}</div>
        </div>
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
          <button className="pill tgl" aria-pressed={showScores}
            onClick={() => setShowScores((v) => !v)}
            title="Show every event's score in each column">
            <span className="mono" aria-hidden>{showScores ? "✓" : "+"}</span> All scores
          </button>
        </div>
      </div>

      {/* ===== MAIN GRID ===== */}
      <div className="grid solo">
        {/* LEADERBOARD */}
        <div className="card">
          <div className="card-h">
            <h3>{activeCol ? `${activeCol.code} · ${activeCol.name}` : scored ? "Overall Standings" : "Start List"}</h3>
            {activeCol ? (
              <Link className="meta evgo" href={eventHref(activeCol.code, year)}>View event →</Link>
            ) : (
              <span className="meta">{division === "men" ? "Men" : "Women"} · {lb.totalCompetitors} athletes</span>
            )}
          </div>
          <div className="tscroll">
            <table className="lb" style={{ minWidth: tableMinWidth }}>
              <thead>
                <tr>
                  <th className="l" style={{ width: 96 }}>{activeCol ? "Finish" : scored ? "Rank" : "Seed"}</th>
                  <th className="l" style={{ width: 260 }}>Athlete</th>
                  {columns.map((c) => (
                    <th key={c.code} title={c.name} className={activeCol?.code === c.code ? "sel" : undefined}>{c.code}</th>
                  ))}
                  <th style={{ width: 132 }}>{scored ? "Points" : ""}</th>
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
                      <div className="rank">
                        <span className="n">{pos}</span>
                        {!activeCol && movement.size > 0 ? (
                          <Delta v={movement.get(r.name) ?? 0} />
                        ) : null}
                      </div>
                    </td>
                    <td className="l">
                      <Link className="athlink" href={athleteHref(division, r, year)}>
                        <div className="athlete">
                          <Avatar row={r} />
                          <div>
                            <div className="ath">{r.name}<span className="cc">{r.countryCode}</span></div>
                            <div className="aff">{r.affiliate || "—"}</div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    {columns.map((c) => {
                      const s = r.scores.find((x) => x.ordinal === c.ordinal);
                      const sel = activeCol?.code === c.code;
                      const showRes = (sel || showScores) && s && s.display;
                      const title = s ? [s.display, s.points != null ? `${s.points} pts` : ""].filter(Boolean).join(" · ") : undefined;
                      return (
                        <td className={`ev${sel ? " sel" : ""}${showScores && !sel ? " showres" : ""}`} key={c.code} title={title}>
                          {s && s.place != null
                            ? <span className={placeClass(s.place)}>{s.place}</span>
                            : <span className="plc empty">—</span>}
                          {showRes ? <span className="evres mono">{s.display}</span> : null}
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
    </>
  );
}

// Rank-movement chip shown beside the overall rank: ▲/▼ with the number of
// places gained or lost in the latest event, or a dash when unchanged.
function Delta({ v }: { v: number }) {
  if (v === 0) return <span className="delta flat" title="No change">–</span>;
  const up = v > 0;
  const n = Math.abs(v);
  return (
    <span
      className={`delta ${up ? "up" : "down"}`}
      title={`${up ? "Up" : "Down"} ${n} ${n === 1 ? "place" : "places"} in the last event`}
    >
      {up ? "▲" : "▼"}{n}
    </span>
  );
}
