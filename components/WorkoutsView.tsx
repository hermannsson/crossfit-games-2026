import Link from "next/link";
import type { Snapshot, WorkoutBlock } from "@/lib/crossfit/types";
import { eventHref } from "./shared";

// Workouts page body: one card per released event workout.
export default function WorkoutsView({ snapshot, year }: { snapshot: Snapshot; year: number }) {
  const { workouts } = snapshot;
  return (
    <section className="blk">
      <div className="blk-h">
        <h2>Workouts</h2>
        <span className="c mono">Individual division · loads ♀ / ♂</span>
      </div>
      <div className="wods">
        {workouts.map((w) => <WorkoutCard key={w.eventId} w={w} year={year} />)}
      </div>
    </section>
  );
}

function WorkoutCard({ w, year }: { w: WorkoutBlock; year: number }) {
  return (
    <div className="wod">
      <div className="top">
        {w.code
          ? <Link className="code evlink" href={eventHref(w.code, year)}>{w.code}</Link>
          : <span className="code">{w.code}</span>}
        <span className="tag">{w.dayLabel}</span>
      </div>
      <h4>
        {w.code
          ? <Link className="evlink" href={eventHref(w.code, year)}>{w.name}</Link>
          : w.name}
      </h4>
      <div className="lines">
        {w.description.map((line, i) => {
          const cls = /^[♀♂]/.test(line) ? "load" : /(:$|^then,?$)/i.test(line) ? "step" : "";
          return <div key={i} className={cls}>{line}</div>;
        })}
      </div>
    </div>
  );
}
