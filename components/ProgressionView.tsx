"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AthleteRow, Division, Snapshot } from "@/lib/crossfit/types";
import { athleteHref, eventHref, shortName } from "./shared";

// Placement-progression tab: a "bump chart" that reads like a leaderboard with
// moving lines. Each athlete is a line; the vertical axis is placement (1 at the
// top). In "Standings" mode the line tracks cumulative rank after each event —
// the race for the title; in "Event finish" mode it tracks where they placed in
// each individual event. Everything is derived from event points, consistent
// with the standings on the Leaderboard tab.

type ChartMode = "cumulative" | "event";

// Mid-tone hues chosen to stay legible on both the light and dark panels.
const PALETTE = [
  "#E12219", "#2E7DEF", "#12A150", "#B7791F", "#7C5CFC", "#E0489E",
  "#0EA5C4", "#E5791B", "#4B9E4B", "#8E7CC3", "#C2410C", "#0891B2",
];

// SVG layout (px). The chart lives in a horizontally scrollable wrapper so many
// events scroll rather than cram, mirroring the leaderboard table.
const PAD_L = 56; // rank axis gutter
const PAD_R = 200; // end-label lane
const PAD_T = 52; // event-code header
const PAD_B = 28;
const COL = 98; // horizontal step per event
const ROW = 30; // vertical step per rank

interface Node {
  stage: number;
  value: number; // rank (cumulative) or finish place (event)
}

interface Series {
  row: AthleteRow;
  color: string;
  finalRank: number;
  cum: Node[]; // cumulative-standings trajectory (stages 0..lastActive)
  ev: Node[]; // per-event-finish trajectory (present stages only)
}

export default function ProgressionView({ snapshot, year }: { snapshot: Snapshot; year: number }) {
  const { leaderboards } = snapshot;
  const router = useRouter();

  const [division, setDivision] = useState<Division>("men");
  const [mode, setMode] = useState<ChartMode>("cumulative");
  const [topN, setTopN] = useState(10);
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const lb = leaderboards[division];

  // Events that have a posted finish, in competition order.
  const scoredCols = useMemo(() => {
    const scored = new Set<number>();
    for (const r of lb.rows) for (const s of r.scores) if (s.place != null) scored.add(s.ordinal);
    return lb.columns.filter((c) => scored.has(c.ordinal));
  }, [lb]);

  // Build every athlete's trajectory, then keep the top finishers so the chart
  // stays readable. Ranks are computed across the whole field for honesty.
  const allSeries = useMemo<Series[]>(() => {
    const S = scoredCols.length;
    const active = lb.rows.filter((r) => r.scores.some((s) => s.place != null));

    // Cumulative points per athlete at each stage.
    const cumPts = active.map((r) => {
      let t = 0;
      return scoredCols.map((c) => {
        const s = r.scores.find((x) => x.ordinal === c.ordinal);
        t += s?.points ?? 0;
        return t;
      });
    });
    // Standard competition rank at a stage (higher cumulative points = better).
    const rankAt = (k: number, i: number) =>
      1 + cumPts.filter((p) => p[k] > cumPts[i][k]).length;

    const built = active.map((r, i) => {
      const placeAt = scoredCols.map((c) => r.scores.find((x) => x.ordinal === c.ordinal)?.place ?? null);
      let lastActive = -1;
      for (let k = 0; k < S; k++) if (placeAt[k] != null) lastActive = k;

      const cum: Node[] = [];
      for (let k = 0; k <= lastActive; k++) cum.push({ stage: k, value: rankAt(k, i) });
      const ev: Node[] = [];
      for (let k = 0; k < S; k++) if (placeAt[k] != null) ev.push({ stage: k, value: placeAt[k]! });

      return {
        row: r,
        color: "",
        finalRank: lastActive >= 0 ? rankAt(lastActive, i) : Infinity,
        cum,
        ev,
      };
    });

    return built.sort((a, b) => a.finalRank - b.finalRank);
  }, [lb, scoredCols]);

  const series = useMemo(
    () => allSeries.slice(0, topN).map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] })),
    [allSeries, topN],
  );

  const nodesFor = (s: Series) => (mode === "cumulative" ? s.cum : s.ev);

  // Vertical extent depends on the mode (cumulative ranks vs event finishes).
  const yMax = useMemo(() => {
    let m = 1;
    for (const s of series) for (const n of nodesFor(s)) if (n.value > m) m = n.value;
    return m;
  }, [series, mode]);

  const S = scoredCols.length;
  // A progression needs ≥2 events; until then (live Games before results land)
  // the tab shows a waiting state rather than an empty axis.
  const ready = S >= 2;
  const width = PAD_L + (S - 1) * COL + PAD_R;
  const height = PAD_T + (yMax - 1) * ROW + PAD_B;
  const x = (stage: number) => PAD_L + stage * COL;
  const y = (rank: number) => PAD_T + (rank - 1) * ROW;

  const q = query.trim().toLowerCase();
  const matches = (s: Series) => s.row.name.toLowerCase().includes(q);
  // Which lines are emphasised: search matches take priority, else the hovered
  // line. A single focused line also gets its per-node values labelled.
  const focusNames = q
    ? new Set(series.filter(matches).map((s) => s.row.name))
    : hovered
      ? new Set([hovered])
      : null;
  const soloFocus = focusNames && focusNames.size === 1 ? [...focusNames][0] : null;

  const rankTicks: number[] = [];
  for (let r = 1; r <= yMax; r++) if (r === 1 || r % 5 === 0) rankTicks.push(r);

  return (
    <>
      {/* ===== TOOLBAR ===== */}
      <div className="toolbar">
        <div className="toolbar-top">
          <div className="seg" role="group" aria-label="Division">
            <button aria-pressed={division === "men"} onClick={() => setDivision("men")}>Men</button>
            <button aria-pressed={division === "women"} onClick={() => setDivision("women")}>Women</button>
          </div>
          {ready && (
            <div className="seg" role="group" aria-label="Chart mode">
              <button aria-pressed={mode === "cumulative"} onClick={() => setMode("cumulative")}>Standings</button>
              <button aria-pressed={mode === "event"} onClick={() => setMode("event")}>Event finish</button>
            </div>
          )}
          {ready && (
            <label className="search">
              <span className="mono" aria-hidden>⌕</span>
              <input placeholder="Trace athlete…" aria-label="Trace athlete"
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
        </div>
        {ready && (
          <div className="pills" role="group" aria-label="How many athletes">
            <span className="lbl">Show</span>
            {[10, 20, allSeries.length].map((n, i) => {
              const label = i === 2 ? "All" : `Top ${n}`;
              const capped = Math.min(n, allSeries.length);
              return (
                <button key={label} className="pill" aria-pressed={topN === capped}
                  onClick={() => setTopN(capped)}>{label}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== CHART ===== */}
      <div className="grid solo">
        <div className="card">
          <div className="card-h">
            <h3>{mode === "cumulative" ? "Standings Progression" : "Event Finishes"}</h3>
            {ready && <span className="meta">Hover a line to trace it · click to open the athlete</span>}
          </div>
          {!ready ? (
            <div className="bump-empty">
              <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden fill="none">
                <path d="M6 34 L18 22 L28 30 L42 12" stroke="var(--border-2)" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="34" r="3" fill="var(--border-2)" />
                <circle cx="18" cy="22" r="3" fill="var(--border-2)" />
                <circle cx="28" cy="30" r="3" fill="var(--border-2)" />
                <circle cx="42" cy="12" r="3" fill="var(--accent)" />
              </svg>
              <p>
                {S === 0
                  ? `No ${division === "men" ? "men's" : "women's"} events scored yet.`
                  : `Only one ${division === "men" ? "men's" : "women's"} event scored so far.`}
              </p>
              <span className="sub">The progression chart builds automatically once a second event is complete.</span>
            </div>
          ) : (
          <div className="tscroll bumpwrap">
            <svg width={width} height={height} role="img"
              aria-label={`Placement progression across ${S} events`}>
              {/* horizontal rank gridlines + axis labels */}
              {rankTicks.map((r) => (
                <g key={`tick-${r}`}>
                  <line x1={PAD_L} x2={width - PAD_R} y1={y(r)} y2={y(r)}
                    stroke="var(--border)" strokeWidth={1} />
                  <text x={PAD_L - 14} y={y(r)} textAnchor="end" dominantBaseline="middle"
                    className="mono" style={{ fill: "var(--text-3)", fontSize: 11, fontWeight: 600 }}>{r}</text>
                </g>
              ))}
              {/* event-code column headers */}
              {scoredCols.map((c, k) => (
                <text key={c.code} x={x(k)} y={PAD_T - 26} textAnchor="middle"
                  className="mono bump-code" onClick={() => router.push(eventHref(c.code, year))}>
                  <title>{c.name}</title>{c.code}
                </text>
              ))}
              {/* one group per athlete: wide invisible hit path + visible line + dots */}
              {series.map((s) => {
                const nodes = nodesFor(s);
                if (nodes.length === 0) return null;
                const d = nodes.map((n, i) => `${i ? "L" : "M"}${x(n.stage)},${y(n.value)}`).join(" ");
                const dim = focusNames != null && !focusNames.has(s.row.name);
                const last = nodes[nodes.length - 1];
                const showValues = soloFocus === s.row.name;
                return (
                  <g key={s.row.name} style={{ opacity: dim ? 0.12 : 1, transition: "opacity .15s" }}
                    onMouseEnter={() => setHovered(s.row.name)} onMouseLeave={() => setHovered(null)}
                    onClick={() => router.push(athleteHref(division, s.row, year))}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: "pointer" }} />
                    <path d={d} fill="none" stroke={s.color}
                      strokeWidth={soloFocus === s.row.name ? 3.5 : 2.25}
                      strokeLinejoin="round" strokeLinecap="round" style={{ cursor: "pointer" }} />
                    {nodes.map((n) => (
                      <g key={n.stage}>
                        <circle cx={x(n.stage)} cy={y(n.value)} r={showValues ? 4.5 : 3.25}
                          fill="var(--panel)" stroke={s.color} strokeWidth={2} style={{ cursor: "pointer" }} />
                        {showValues && (
                          <text x={x(n.stage)} y={y(n.value) - 11} textAnchor="middle"
                            className="mono" style={{ fill: s.color, fontSize: 10.5, fontWeight: 700 }}>{n.value}</text>
                        )}
                      </g>
                    ))}
                    {/* end label (right): final standing + name */}
                    <text x={x(last.stage) + 14} y={y(last.value)} dominantBaseline="middle"
                      className="bump-name" style={{ cursor: "pointer" }}>
                      <tspan className="mono" style={{ fill: s.color, fontWeight: 700 }}>{s.finalRank}.</tspan>
                      <tspan dx={7} style={{ fill: "var(--text)", fontWeight: 600 }}>{shortName(s.row)}</tspan>
                      <tspan dx={6} className="mono" style={{ fill: "var(--text-3)", fontSize: 10 }}>{s.row.countryCode}</tspan>
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          )}
        </div>
      </div>
    </>
  );
}
