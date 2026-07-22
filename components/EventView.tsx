import Link from "next/link";
import type { Division, Snapshot } from "@/lib/crossfit/types";
import {
  Avatar,
  athleteHref,
  fmtClock,
  fmtRange,
  placeClass,
  placeIn,
  venueShort,
  withYear,
} from "./shared";

// Event detail page body: ties together the three data sources we hold for a
// single event — the workout description, the heat draw, and the ranked
// results per division — behind one code (e.g. "IE1").
export default function EventView({
  snapshot,
  code,
  year,
}: {
  snapshot: Snapshot;
  code: string;
  year: number;
}) {
  const { meta, leaderboards, schedule, workouts } = snapshot;
  const scored = meta.scored;

  // Event name comes from the leaderboard column; both divisions share columns.
  const column = leaderboards.men.columns.find((c) => c.code === code);
  const name = column?.name ?? code;
  const ordinal = column?.ordinal ?? 0;

  const workout = workouts.find((w) => w.code === code);
  const entry = schedule.find((e) => e.codes.includes(code));

  return (
    <>
      <div className="crumb">
        <Link href={withYear("/", year)}>← Leaderboard</Link>
        <span className="sep">/</span>
        <span className="here">Event</span>
      </div>

      <div className="ehead">
        <span className="ecode">{code}</span>
        <h1>{name}</h1>
        {entry && (
          <div className="emeta mono">
            {entry.dayLabel}
            {entry.startTime ? ` · ${fmtRange(entry.startTime, entry.endTime)}` : ""}
            {entry.venue ? ` · ${venueShort(entry.venue)}` : ""}
          </div>
        )}
      </div>

      {workout && (
        <div className="workout">
          <div className="lines">
            {workout.description.map((line, i) => {
              const cls = /^[♀♂]/.test(line) ? "load" : /(:$|^then,?$)/i.test(line) ? "step" : "";
              return <div key={i} className={cls}>{line}</div>;
            })}
          </div>
        </div>
      )}

      {entry && entry.heats.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-h"><h3>Heat Draw</h3><span className="meta">{fmtClock(entry.startTime)}</span></div>
          <div className="heatgrid" style={{ padding: 16 }}>
            {entry.heats.map((h, i) => (
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
        </div>
      )}

      <div className="dgrid" style={{ marginTop: 18 }}>
        <ResultsCard snapshot={snapshot} division="men" ordinal={ordinal} scored={scored} year={year} />
        <ResultsCard snapshot={snapshot} division="women" ordinal={ordinal} scored={scored} year={year} />
      </div>
    </>
  );
}

function ResultsCard({
  snapshot,
  division,
  ordinal,
  scored,
  year,
}: {
  snapshot: Snapshot;
  division: Division;
  ordinal: number;
  scored: boolean;
  year: number;
}) {
  const lb = snapshot.leaderboards[division];
  // Rank by finish in this event; unplaced athletes drop to the bottom in their
  // seed order.
  const rows = [...lb.rows].sort((a, b) => placeIn(a, ordinal) - placeIn(b, ordinal));

  return (
    <div className="card">
      <div className="card-h">
        <h3>{division === "men" ? "Men" : "Women"}</h3>
        <span className="meta">{scored ? "results" : "start list"}</span>
      </div>
      <div className="tscroll">
        <table className="rt">
          <thead>
            <tr>
              <th className="l" style={{ width: 66 }}>{scored ? "Finish" : "Seed"}</th>
              <th className="l">Athlete</th>
              <th style={{ width: 120 }}>Result</th>
              <th style={{ width: 76 }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.scores.find((x) => x.ordinal === ordinal);
              const pos = s && s.place != null ? s.place : i + 1;
              return (
                <tr key={r.name + i}>
                  <td className="l">
                    {s && s.place != null
                      ? <span className={placeClass(s.place)}>{s.place}</span>
                      : <span className="mono seedn">{pos}</span>}
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
                  <td className="mono res">{s && s.display ? s.display : "—"}</td>
                  <td className="mono">{s && s.points != null ? s.points : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
