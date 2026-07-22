import Link from "next/link";
import type { AthleteRow, Division, Snapshot } from "@/lib/crossfit/types";
import { eventHref, placeClass, withYear } from "./shared";

// Athlete detail page body: a profile header with summary stats, plus the
// athlete's event-by-event results. Each event row links to that event's page.
export default function AthleteView({
  snapshot,
  division,
  row,
  year,
}: {
  snapshot: Snapshot;
  division: Division;
  row: AthleteRow;
  year: number;
}) {
  const { meta, leaderboards } = snapshot;
  const lb = leaderboards[division];
  const columns = lb.columns;
  const scored = meta.scored;

  // Before scoring the API leaves rank at 0, so fall back to roster position —
  // matching how the leaderboard numbers its start list.
  const seed = row.rank > 0 ? row.rank : lb.rows.indexOf(row) + 1;

  // Summary stats over the scored events.
  const placed = row.scores.filter((s) => s.place != null);
  const wins = placed.filter((s) => s.place === 1).length;
  const podiums = placed.filter((s) => s.place != null && s.place <= 3).length;
  const best = placed.length ? Math.min(...placed.map((s) => s.place as number)) : null;

  const divLabel = division === "men" ? "Men" : "Women";

  return (
    <>
      <div className="crumb">
        <Link href={withYear("/", year)}>← Leaderboard</Link>
        <span className="sep">/</span>
        <span className="here">{divLabel}</span>
      </div>

      <div className="profile">
        <ProfilePic row={row} />
        <div className="id">
          <div className="rk">{scored && row.rank > 0 ? `Rank #${row.rank}` : `Seed #${seed}`} · {divLabel}</div>
          <h1>{row.name}</h1>
          <div className="facts">
            {row.country && <span><span className="mono">{row.countryCode || "—"}</span>{row.country}</span>}
            {row.affiliate && <span>{row.affiliate}</span>}
            {row.region && <span>{row.region}</span>}
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="n">{scored && row.totalPoints != null ? row.totalPoints : "—"}</div>
            <div className="l">Points</div>
          </div>
          <div className="stat">
            <div className="n">{best ?? "—"}</div>
            <div className="l">Best finish</div>
          </div>
          <div className="stat">
            <div className="n">{wins}</div>
            <div className="l">Event wins</div>
          </div>
          <div className="stat">
            <div className="n">{podiums}</div>
            <div className="l">Top 3</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <h3>Event Results</h3>
          <span className="meta">{scored ? `${placed.length} / ${columns.length} scored` : "not yet scored"}</span>
        </div>
        <div className="tscroll">
          <table className="rt">
            <thead>
              <tr>
                <th className="l" style={{ width: 66 }}>Event</th>
                <th className="l">Workout</th>
                <th style={{ width: 96 }}>Finish</th>
                <th style={{ width: 140 }}>Result</th>
                <th style={{ width: 96 }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => {
                const s = row.scores.find((x) => x.ordinal === c.ordinal);
                return (
                  <tr key={c.code}>
                    <td className="l"><span className="evcode">{c.code}</span></td>
                    <td className="l">
                      <Link className="evlink" href={eventHref(c.code, year)}>{c.name}</Link>
                    </td>
                    <td>
                      {s && s.place != null
                        ? <span className={placeClass(s.place)}>{s.place}</span>
                        : <span className="plc empty">—</span>}
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
    </>
  );
}

function ProfilePic({ row }: { row: AthleteRow }) {
  if (row.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="pic" src={row.photo} alt="" />;
  }
  const initials = `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase();
  return <div className="pic ph">{initials || "—"}</div>;
}
