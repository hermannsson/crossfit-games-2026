// Unit tests for the column-derivation logic — the join between the display
// slate (schedule/workout names) and the leaderboard API's ordinals (which key
// the per-event scores) — plus the CMS code resolver. Run: `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { namedEvents, deriveColumns } from "./snapshot";
import { eventCodes } from "./crossfit/api";
import type { LeaderboardColumn, ScheduleEntry, WorkoutBlock } from "./crossfit/types";

// A minimal ScheduleEntry with just the fields namedEvents reads.
function entry(codes: string[], name: string): ScheduleEntry {
  return {
    order: 0, codeLabel: "", codes, name, kicker: "",
    dayKey: "", dayLabel: "", daySection: "",
    startTime: null, endTime: null, venue: "", heats: [],
  };
}

// The real 2026 slate: 20 individual events (IE1–IE20), two rows combining
// several (IE3–5, IE16–17), plus a no-code Opening Ceremony row that is not an
// event and must contribute no column.
const SCHEDULE_2026: ScheduleEntry[] = [
  entry(["IE1"], "Event One"),
  entry(["IE2"], "Event Two"),
  entry(["IE3", "IE4", "IE5"], "The Total"),
  entry(["IE6"], "Event Six"),
  entry(["IE7"], "Event Seven"),
  entry([], "Opening Ceremony"), // no code — contributes no event
  entry(["IE8"], "Event Eight"),
  entry(["IE9"], "Event Nine"),
  entry(["IE16", "IE17"], "Double"),
  entry(["IE20"], "Event Twenty"),
];

// The leaderboard API's ordinals: sequential 1..N counters, no IE concept.
function apiOrds(n: number): LeaderboardColumn[] {
  return Array.from({ length: n }, (_, i) => ({
    ordinal: i + 1, code: `E${i + 1}`, name: `Event ${i + 1}`,
  }));
}

test("namedEvents expands combined rows, includes IE7, drops the no-code row", () => {
  const named = namedEvents(SCHEDULE_2026, []);
  assert.deepEqual(
    named.map((e) => e.code),
    ["IE1", "IE2", "IE3", "IE4", "IE5", "IE6", "IE7", "IE8", "IE9", "IE16", "IE17", "IE20"],
  );
  // The three Total lifts each carry the combined row's name.
  assert.equal(named.find((e) => e.code === "IE4")?.name, "The Total");
});

test("contiguous API ordinals: each event's score lands on its own column", () => {
  const named = namedEvents(SCHEDULE_2026, []); // 12 named events
  // API has scored everything so far, numbered 1..12 with no gap.
  const cols = deriveColumns(named, apiOrds(12));

  // The i-th named event lines up with the API's i-th ordinal.
  assert.equal(cols.find((c) => c.code === "IE6")!.ordinal, 6);
  assert.equal(cols.find((c) => c.code === "IE7")!.ordinal, 7);
  assert.equal(cols.find((c) => c.code === "IE8")!.ordinal, 8);
  // Every column ordinal is unique — no two columns fight over one score.
  const ords = cols.map((c) => c.ordinal);
  assert.equal(new Set(ords).size, ords.length);
});

test("positional join stays collision-free even if the API ever emits a gap", () => {
  const named = namedEvents(SCHEDULE_2026, []); // 12 named events
  // Defensive: should the API ever skip an ordinal, names still line up slot
  // for slot and no two columns collide on one score.
  const gapped: LeaderboardColumn[] = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13].map(
    (o) => ({ ordinal: o, code: `E${o}`, name: `Event ${o}` }),
  );
  const cols = deriveColumns(named, gapped);
  assert.equal(cols.length, named.length);
  const ords = cols.map((c) => c.ordinal);
  assert.equal(new Set(ords).size, ords.length); // collision-free
});

test("eventCodes: headline codes win over a wrong workout_name (the IE7 case)", () => {
  // CrossFit's CMS tags IE7 as a team row with workout_name ["event2"]; the
  // "IE7" headline is authoritative and must not be mislabeled IE2.
  assert.deepEqual(eventCodes("IE7", ["event2"]), ["IE7"]);
  // Named events carry no code in the headline — fall back to workout_name.
  assert.deepEqual(eventCodes("2007 Hopper", ["event1"]), ["IE1"]);
  assert.deepEqual(
    eventCodes("The CrossFit Total", ["event3", "event4", "event5"]),
    ["IE3", "IE4", "IE5"],
  );
  // Combined and prefixed headlines parse straight from the headline.
  assert.deepEqual(eventCodes("IE16 and IE17", undefined), ["IE16", "IE17"]);
  assert.deepEqual(eventCodes("IE13 - 500 Run", undefined), ["IE13"]);
  // Non-events (Opening Ceremony) resolve to no code and are dropped upstream.
  assert.deepEqual(eventCodes("Opening Ceremony", undefined), []);
});

test("seeding: no API ordinals -> sequential columns, full slate shown", () => {
  const named = namedEvents(SCHEDULE_2026, []);
  const cols = deriveColumns(named, []);
  assert.equal(cols.length, named.length);
  assert.deepEqual(cols.map((c) => c.ordinal), named.map((_, i) => i + 1));
});

test("partial scoring: scored columns take API ordinals, upcoming stay collision-free", () => {
  const named = namedEvents(SCHEDULE_2026, []); // 12 events
  const cols = deriveColumns(named, apiOrds(3)); // only 3 scored so far

  assert.equal(cols.length, 12); // full slate still rendered
  assert.deepEqual(cols.slice(0, 3).map((c) => c.ordinal), [1, 2, 3]);
  // Provisional ordinals for the unscored tail continue past the API's max (3)
  // and never reuse a scored ordinal.
  const provisional = cols.slice(3).map((c) => c.ordinal);
  assert.ok(provisional.every((o) => o > 3));
  const ords = cols.map((c) => c.ordinal);
  assert.equal(new Set(ords).size, ords.length);
});

test("past season: no schedule -> names come from the workouts feed", () => {
  const workouts: WorkoutBlock[] = [
    { code: "IE1", eventId: "a", name: "Bike", dayLabel: "", dayKey: "", description: [] },
    { code: "IE2", eventId: "b", name: "Run", dayLabel: "", dayKey: "", description: [] },
  ];
  const named = namedEvents([], workouts);
  assert.deepEqual(named, [
    { code: "IE1", name: "Bike" },
    { code: "IE2", name: "Run" },
  ]);
  const cols = deriveColumns(named, apiOrds(2));
  assert.deepEqual(cols.map((c) => c.name), ["Bike", "Run"]);
});

test("no names at all: fall back to the API's own ordinal columns", () => {
  const cols = deriveColumns([], apiOrds(2));
  assert.deepEqual(cols, apiOrds(2));
});
