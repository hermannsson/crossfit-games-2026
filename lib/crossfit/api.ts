// Client for the official CrossFit Games data API (c3po.crossfit.com).
// All endpoints are public JSON, no auth. Discovered by tracing the live site.

import type {
  AthleteRow,
  Division,
  LeaderboardColumn,
  Meta,
  ScheduleEntry,
  EventScore,
  Heat,
} from "./types";
import type { CompetitionConfig } from "./competitions";

const HOST = "https://c3po.crossfit.com";
const PICS = "https://profilepicsbucket.crossfit.com";
// The finals leaderboard is served under the "finals" container, selecting the
// Games via final={id}. Competition metadata + the real identifier live under
// the "games/{year}" slug. Which season we hit is driven by a CompetitionConfig
// (see competitions.ts) rather than hardcoded constants.

const DIVISION_ID: Record<Division, number> = { men: 1, women: 2 };

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    // Cache for 60s and tag so /api/refresh can bust it on demand. (In the
    // plain-node fetch script this option is ignored and requests run fresh.)
    next: { revalidate: 60, tags: ["cf-data"] },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

/* ----------------------------- metadata ----------------------------- */

export async function fetchMeta(comp: CompetitionConfig): Promise<Meta> {
  const raw = await getJSON<any>(
    `${HOST}/api/competitions/v1/competitions/${comp.metaSlug}?expand[]=controls`,
  );
  const mode: string = raw.leaderboard_mode ?? "unknown";
  return {
    competitionId: raw.id,
    identifier: raw.identifier,
    name: raw.competition_name ?? raw.name,
    year: Number(raw.year),
    startDate: toISO(raw.start_date),
    endDate: toISO(raw.end_date),
    leaderboardMode: mode,
    scored: false, // set true later if any leaderboard row has scores
    generatedAt: new Date().toISOString(),
  };
}

/* --------------------------- leaderboard ---------------------------- */

export async function fetchLeaderboard(
  comp: CompetitionConfig,
  division: Division,
): Promise<{ rows: AthleteRow[]; totalCompetitors: number; columns: LeaderboardColumn[] }> {
  const rows: AthleteRow[] = [];
  let page = 1;
  let totalPages = 1;
  let totalCompetitors = 0;
  let columns: LeaderboardColumn[] = [];

  do {
    const url =
      `${HOST}/api/leaderboards/v2/competitions/${comp.compSlug}/leaderboards` +
      `?final=${comp.finalId}&division=${DIVISION_ID[division]}&sort=2&page=${page}`;
    const raw = await getJSON<any>(url);
    totalPages = raw?.pagination?.totalPages ?? 1;
    totalCompetitors = raw?.pagination?.totalCompetitors ?? rows.length;
    if (columns.length === 0) columns = columnsFromOrdinals(raw?.ordinals);

    for (const r of raw.leaderboardRows ?? []) {
      rows.push(toAthleteRow(r, division));
    }
    page += 1;
  } while (page <= totalPages);

  return { rows, totalCompetitors, columns };
}

// The leaderboard response carries an `ordinals` array describing its event
// columns. Names there are bare numbers ("1".."10"), so this is the fallback
// used when the richer workouts source (current-year only) isn't available.
function columnsFromOrdinals(ordinals: any): LeaderboardColumn[] {
  if (!Array.isArray(ordinals)) return [];
  return ordinals.map((o: any, i: number) => {
    const ordinal = Number(o?.ordinal ?? i + 1);
    return { ordinal, code: `E${ordinal}`, name: `Event ${ordinal}` };
  });
}

function toAthleteRow(r: any, gender: Division): AthleteRow {
  const e = r.entrant ?? {};
  const name: string = e.competitorName ?? "";
  const { first, last } = splitName(name, e.firstName, e.lastName);
  const totalRaw = r.overallScore;
  const totalPoints =
    totalRaw != null && `${totalRaw}`.trim() !== "" && !isNaN(Number(totalRaw))
      ? Number(totalRaw)
      : null;

  const scores: EventScore[] = Array.isArray(r.scores)
    ? r.scores
        .map((s: any, i: number): EventScore => {
          const place =
            s.rank != null && `${s.rank}`.trim() !== "" ? Number(s.rank) : null;
          // Per-event points come back in `score` (a bare number like "92");
          // `scoreDisplay` holds the human result ("46:45.00"). Older shapes
          // used a `points` field, so accept that as a fallback.
          const rawPoints = s.points ?? s.score;
          const points =
            rawPoints != null && `${rawPoints}`.trim() !== ""
              ? Number(rawPoints)
              : null;
          return {
            ordinal: Number(s.ordinal ?? i + 1),
            place: Number.isFinite(place as number) ? place : null,
            points: Number.isFinite(points as number) ? points : null,
            display: s.scoreDisplay ?? s.score ?? "",
          };
        })
        .filter((s: EventScore) => s.display !== "" || s.place != null)
    : [];

  return {
    rank: Number(r.overallRank) || 0,
    name,
    firstName: first,
    lastName: last,
    countryCode: countryCode(e.countryOfOriginName ?? e.countryChampionName ?? ""),
    country: e.countryOfOriginName ?? "",
    region: e.regionName ?? "",
    affiliate: e.affiliateName ?? "",
    gender,
    photo: e.profilePicS3key ? `${PICS}/${e.profilePicS3key}` : "",
    totalPoints,
    scores,
  };
}

/* ----------------------------- schedule ----------------------------- */

// The published schedule (names, days, real times, venues) lives in the CMS.
// The c3po /schedules feed carries generic names but the real heat draws
// (which athlete in which heat/lane), which we join in by event code.

const CMS = "https://cms-api.crossfit.com/tiles?full_path=/games/finals/schedule";

export async function fetchSchedule(identifier: string): Promise<ScheduleEntry[]> {
  const [entries, heatsByCode] = await Promise.all([
    fetchScheduleCMS(),
    fetchHeats(identifier),
  ]);
  return entries.map((e) => ({ ...e, heats: attachHeats(e.codes, heatsByCode) }));
}

async function fetchScheduleCMS(): Promise<Omit<ScheduleEntry, "heats">[]> {
  const raw = await getJSON<any>(CMS);
  const comp = raw?.tiles?.[0]?.acf?.components?.find(
    (c: any) => c.acf_fc_layout === "schedule_component",
  );
  const set = comp?.schedule_component?.schedules?.[0];
  const out: Omit<ScheduleEntry, "heats">[] = [];
  let order = 0;

  for (const block of set?.blocks ?? []) {
    const section = (block.headline_text ?? "").trim();
    for (const it of block.items ?? []) {
      if (it.competition_user_type !== "individual") continue;
      const headline = (it.headline_text ?? "").trim();
      // Prefer the structured `workout_name` field (e.g. ["event1"], or
      // ["event3","event4","event5"] for combined lifts) — the CMS drops the
      // "IEn - " prefix from some named events' headlines but keeps this. Fall
      // back to parsing IE codes out of the headline when it's absent.
      const wn: string[] = Array.isArray(it.workout_name) ? it.workout_name : [];
      const codes = wn.length
        ? wn.map((w) => `IE${String(w).replace(/\D/g, "")}`).filter((c) => /^IE\d+$/.test(c))
        : (headline.match(/IE\d+/g) ?? []).map((c: string) => normalizeCode(c));
      const start = it.start_date ?? null;
      const d = start ? new Date(start) : null;
      out.push({
        order: order++,
        codeLabel: codeLabel(codes),
        codes,
        name: deriveName(headline, codes),
        kicker: (it.kicker ?? "").trim(),
        daySection: section,
        dayKey: d ? isoDay(d) : "",
        dayLabel: d ? dayLabel(d) : section,
        startTime: start,
        endTime: it.end_date ?? null,
        venue: (it.location_text ?? "").trim(),
      });
    }
  }
  return out;
}

async function fetchHeats(identifier: string): Promise<Map<string, Heat[]>> {
  const raw = await getJSON<any[]>(
    `${HOST}/api/competitions/v1/competitions/${identifier}/schedules`,
  );
  const map = new Map<string, Heat[]>();
  for (const s of raw) {
    const code = normalizeCode(s.leaderboard_display ?? "");
    if (!code.startsWith("IE")) continue;
    const gender = s.division_id === 1 ? "Men" : s.division_id === 2 ? "Women" : "";
    const heats: Heat[] = (s.heats ?? []).map((h: any) => ({
      number: Number(h.heat) || 0,
      gender,
      lanes: (h.lanes ?? [])
        .map((l: any) => ({
          lane: Number(l.lane) || 0,
          name: l.entrant_name || `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim(),
        }))
        .sort((a: any, b: any) => a.lane - b.lane),
    }));
    map.set(code, [...(map.get(code) ?? []), ...heats]);
  }
  return map;
}

function attachHeats(codes: string[], map: Map<string, Heat[]>): Heat[] {
  const seen = new Set<string>();
  const out: Heat[] = [];
  for (const c of codes) {
    for (const h of map.get(c) ?? []) {
      const key = `${h.gender}-${h.number}`;
      if (seen.has(key)) continue; // collapse identical draws across combined events
      seen.add(key);
      out.push(h);
    }
  }
  const rank: Record<string, number> = { Women: 0, Men: 1, "": 2 };
  return out.sort((a, b) => (rank[a.gender] - rank[b.gender]) || a.number - b.number);
}

function deriveName(headline: string, codes: string[]): string {
  // Strip a leading code prefix ("IE6 - ", "IE16 and IE17") if the headline
  // carries one; whatever real text remains is the event name. Named events
  // may have no prefix at all ("The 2007 Hopper") — use them verbatim. Only
  // fall back to an "Event N" placeholder when nothing but a code is left.
  const named = headline.replace(/^\s*IE\d+(?:\s*(?:and|&|,|[-–])\s*IE\d+)*\s*[-–]?\s*/i, "").trim();
  if (named) return named;
  if (codes.length) return `Event ${codes.map((c) => c.replace("IE", "")).join(" & ")}`;
  return headline;
}

function codeLabel(codes: string[]): string {
  if (codes.length === 0) return "";
  if (codes.length === 1) return codes[0];
  const nums = codes.map((c) => Number(c.replace("IE", "")));
  return `IE${Math.min(...nums)}–${Math.max(...nums)}`;
}

/* ------------------------------ helpers ----------------------------- */

function toISO(v: string): string {
  // API uses "MM/DD/YYYY HH:mm:ss" (UTC) for meta dates
  if (!v) return "";
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, mo, d, y, h, mi, s] = m;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
  }
  const dt = new Date(v);
  return isNaN(+dt) ? "" : dt.toISOString();
}

function splitName(full: string, first?: string, last?: string) {
  if (first || last) return { first: first ?? "", last: last ?? "" };
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function normalizeCode(display: string): string {
  // "IE01" -> "IE1", "TE03" -> "TE3"
  const m = display.match(/^([A-Za-z]+)0*(\d+)$/);
  return m ? `${m[1].toUpperCase()}${m[2]}` : display.toUpperCase();
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date): string {
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mon = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][d.getUTCMonth()];
  return `${dow} · ${mon} ${d.getUTCDate()}`;
}

// Minimal IOC-style code map for the countries in this field; falls back to
// the first three letters uppercased.
const COUNTRY_CODES: Record<string, string> = {
  "United States": "USA",
  "Canada": "CAN",
  "Australia": "AUS",
  "New Zealand": "NZL",
  "Brazil": "BRA",
  "Great Britain": "GBR",
  "United Kingdom": "GBR",
  "England": "GBR",
  "Ireland": "IRL",
  "France": "FRA",
  "Germany": "GER",
  "Switzerland": "SUI",
  "Italy": "ITA",
  "Spain": "ESP",
  "Portugal": "POR",
  "Netherlands": "NED",
  "Belgium": "BEL",
  "Sweden": "SWE",
  "Norway": "NOR",
  "Denmark": "DEN",
  "Finland": "FIN",
  "Iceland": "ISL",
  "Poland": "POL",
  "Georgia": "GEO",
  "Hungary": "HUN",
  "Czech Republic": "CZE",
  "Mexico": "MEX",
  "Argentina": "ARG",
  "Chile": "CHI",
  "Japan": "JPN",
  "South Africa": "RSA",
  "Israel": "ISR",
};

function countryCode(name: string): string {
  if (!name) return "";
  if (COUNTRY_CODES[name]) return COUNTRY_CODES[name];
  return name.slice(0, 3).toUpperCase();
}
