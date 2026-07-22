import Link from "next/link";
import type { ScheduleEntry, Snapshot } from "@/lib/crossfit/types";
import { groupByDay, fmtRange, eventHref, venueShort } from "./shared";

// Schedule page body: the competition schedule grouped by day, with
// expandable heat draws per event.
export default function ScheduleView({ snapshot, year }: { snapshot: Snapshot; year: number }) {
  const { schedule, leaderboards } = snapshot;
  const eventCount = leaderboards.men.columns.length;
  const days = groupByDay(schedule);

  return (
    <section className="blk">
      <div className="blk-h">
        <h2>Schedule</h2>
        <span className="c mono">{eventCount} events · expand for heat draws</span>
      </div>
      <div className="card sched-scroll">
        <table className="sch">
          <tbody>
            {days.flatMap((d) => [
              <tr className="dayhdr" key={`${d.key}-hdr`}>
                <td colSpan={4}>{d.label} — {venueShort(d.venue)}</td>
              </tr>,
              ...d.entries.map((e) => <EventRow key={e.order} e={e} year={year} />),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventRow({ e, year }: { e: ScheduleEntry; year: number }) {
  const athletes = e.heats.reduce((n, h) => n + h.lanes.length, 0);
  const code = e.codes[0];
  return (
    <tr>
      <td className="tm">{fmtRange(e.startTime, e.endTime)}</td>
      <td className="code">{e.codeLabel}</td>
      <td>
        <div className="nm">
          {code ? <Link className="evlink" href={eventHref(code, year)}>{e.name}</Link> : e.name}
          {e.kicker && <span className="kick">{e.kicker}</span>}
        </div>
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
