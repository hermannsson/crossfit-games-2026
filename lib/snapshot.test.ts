// Unit tests for the column-derivation logic — the join between the display
// slate (schedule/workout names, which carry the gapped IE codes) and the
// leaderboard API's ordinals (which key the per-event scores). Run: `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { namedEvents, deriveColumns } from "./snapshot";
import type { LeaderboardColumn, ScheduleEntry, WorkoutBlock } from "./crossfit/types";

// A minimal ScheduleEntry with just the fields namedEvents reads.
function entry(codes: string[], name: string): ScheduleEntry {
  return {
    order: 0, codeLabel: "", codes, name, kicker: "",
    dayKey: "", dayLabel: "", daySection: "",
    startTime: null, endTime: null, venue: "", heats: [],
  };
}

// The real 2026 slate: IE7 is absent, and two rows combine (IE3–5, IE16–17).
const SCHEDULE_2026: ScheduleEntry[] = [
  entry(["IE1"], "Event One"),
  entry(["IE2"], "Event Two"),
  entry(["IE3", "IE4", "IE5"], "The Total"),
  entry(["IE6"], "Event Six"),
  entry([], "Rest / unannounced"), // the IE7 gap — contributes no event
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

test("namedEvents expands combined rows and drops the empty (IE7) slot", () => {
  const named = namedEvents(SCHEDULE_2026, []);
  assert.deepEqual(
    named.map((e) => e.code),
    ["IE1", "IE2", "IE3", "IE4", "IE5", "IE6", "IE8", "IE9", "IE16", "IE17", "IE20"],
  );
  // The three Total lifts each carry the combined row's name.
  assert.equal(named.find((e) => e.code === "IE4")?.name, "The Total");
});

test("contiguous API ordinals: IE8's score lands on the IE8 column, not shifted", () => {
  const named = namedEvents(SCHEDULE_2026, []); // 11 named events
  // API has scored everything so far, numbered 1..11 with no gap.
  const cols = deriveColumns(named, apiOrds(11));

  const ie6 = cols.find((c) => c.code === "IE6")!;
  const ie8 = cols.find((c) => c.code === "IE8")!;
  assert.equal(ie6.ordinal, 6); // 6th named event -> API ordinal 6
  assert.equal(ie8.ordinal, 7); // 7th named event -> API ordinal 7 (NOT 8)
  // Every column ordinal is unique — no two columns fight over one score.
  const ords = cols.map((c) => c.ordinal);
  assert.equal(new Set(ords).size, ords.length);
});

test("IE-aligned API ordinals (skips 7) also map correctly by position", () => {
  const named = namedEvents(SCHEDULE_2026, []);
  // Hypothetical: the API mirrors the IE gap, emitting 1..6 then 8..12.
  const gapped: LeaderboardColumn[] = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(
    (o) => ({ ordinal: o, code: `E${o}`, name: `Event ${o}` }),
  );
  const cols = deriveColumns(named, gapped);
  // 7th named event (IE8) picks up the API's 7th ordinal, which is 8 here.
  assert.equal(cols.find((c) => c.code === "IE8")!.ordinal, 8);
  assert.equal(cols.find((c) => c.code === "IE6")!.ordinal, 6);
  const ords = cols.map((c) => c.ordinal);
  assert.equal(new Set(ords).size, ords.length); // still collision-free
});

test("seeding: no API ordinals -> sequential columns, full slate shown", () => {
  const named = namedEvents(SCHEDULE_2026, []);
  const cols = deriveColumns(named, []);
  assert.equal(cols.length, named.length);
  assert.deepEqual(cols.map((c) => c.ordinal), named.map((_, i) => i + 1));
});

test("partial scoring: scored columns take API ordinals, upcoming stay collision-free", () => {
  const named = namedEvents(SCHEDULE_2026, []); // 11 events
  const cols = deriveColumns(named, apiOrds(3)); // only 3 scored so far

  assert.equal(cols.length, 11); // full slate still rendered
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
