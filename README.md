# 2026 CrossFit Games — Live

A data-backed website for the 2026 CrossFit Games (individual division): a
dense, results-terminal style leaderboard, schedule, and workouts. Built on the
**official CrossFit Games API** — no scraping of rendered pages except the
workout descriptions (which have no JSON endpoint).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- Plain CSS design system in `app/globals.css` (light + dark, one signal color)
- `cheerio` for the one HTML source (workout descriptions)

## Data sources

| Data | Source | Notes |
|------|--------|-------|
| Metadata / status | `c3po.crossfit.com/api/competitions/v1/competitions/games/2026` | competition 261, dates, mode |
| Leaderboard (men/women) | `…/api/leaderboards/v2/competitions/finals/2026/leaderboards?final=261&division=1\|2` | roster now; per-event scores fill in once scored |
| Workouts | `games.crossfit.com/workouts/finals` (HTML) | names, descriptions, ♀/♂ loads |
| Schedule | derived from workouts (names/days) | the c3po `/schedules` feed is still placeholder pre-competition |

## Commands

```bash
npm install       # once
npm run fetch     # pull a fresh snapshot into /data (one-shot)
npm run dev       # run the site locally
npm run build     # production build
```

`npm run fetch` writes JSON to `/data`. The site reads those files on each
request (`force-dynamic`), so re-running `fetch` updates the site with no
rebuild.

## Live vs. seeding

Before events are scored the API returns a roster, so the site shows **seed
order** with a clear banner and empty event columns. Once CrossFit posts
results, the same components render per-event placements, points, and totals —
re-run `npm run fetch` to pull them in.

## Layout

```
app/            layout, page (server), globals.css
components/     Dashboard.tsx (client — toggles, tabs, search)
lib/crossfit/   api.ts (c3po client), workouts.ts (scraper), types.ts
lib/data.ts     reads the /data snapshot
scripts/fetch.ts one-shot data pull
data/           generated JSON snapshot
```
