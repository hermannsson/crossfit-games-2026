import type { Snapshot, WorkoutBlock } from "@/lib/crossfit/types";

// Workouts page body: one card per released event workout.
export default function WorkoutsView({ snapshot }: { snapshot: Snapshot }) {
  const { workouts } = snapshot;
  return (
    <section className="blk">
      <div className="blk-h">
        <h2>Workouts</h2>
        <span className="c mono">Individual division · loads ♀ / ♂</span>
      </div>
      <div className="wods">
        {workouts.map((w) => <WorkoutCard key={w.eventId} w={w} />)}
      </div>
    </section>
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
