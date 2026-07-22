// Scraper for the individual workout descriptions, which are server-rendered
// HTML at games.crossfit.com/workouts/finals (no JSON API exists for these).
//
// Structure (verified):
//   .workouts-calendar > .column
//     h2.calendar-heading           -> day, e.g. "July 22"
//     a.event-link[data-id][data-date] > h3.workouts-label-heading -> workout name
//     <p> ...                        -> description lines (until next event-link)

import * as cheerio from "cheerio";
import type { WorkoutBlock } from "./types";

const URL = "https://games.crossfit.com/workouts/finals";

export async function fetchWorkouts(): Promise<WorkoutBlock[]> {
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} fetching workouts HTML`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const blocks: WorkoutBlock[] = [];

  $(".workouts-calendar .column").each((_, col) => {
    const dayLabel = $(col).find("h2.calendar-heading").first().text().trim();
    let current: WorkoutBlock | null = null;

    $(col)
      .children()
      .each((__, el) => {
        const $el = $(el);
        const link = $el.is("a.event-link") ? $el : $el.find("a.event-link");

        if (link.length && $el.find("h3.workouts-label-heading").length) {
          if (current) blocks.push(current);
          const heading = $el.find("h3.workouts-label-heading").first();
          current = {
            code: "",
            eventId: link.attr("data-id") ?? "",
            name: heading.text().trim(),
            dayLabel,
            dayKey: link.attr("data-date") ?? "",
            description: [],
          };
        } else if ($el.is("p") && current) {
          const line = cleanText($el.text());
          if (line) current.description.push(line);
        }
      });

    if (current) blocks.push(current);
  });

  return assignCodes(blocks);
}

function cleanText(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

// The calendar lists individual events in competition order; number them IE1..
// (three CrossFit Total lifts count as one listed block, so this is a display
// aid, not a strict ordinal map to the leaderboard.)
function assignCodes(blocks: WorkoutBlock[]): WorkoutBlock[] {
  return blocks.map((b, i) => ({ ...b, code: `IE${i + 1}` }));
}
