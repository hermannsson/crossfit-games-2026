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

`npm run fetch` writes a JSON snapshot to `/data`. This snapshot is the
deploy-time **fallback**: the deployed site fetches live from the CrossFit APIs
on each render, cached with ISR (see below), and only falls back to `/data` if
the API is unreachable.

## Live updates

The homepage revalidates every **60 seconds** (`export const revalidate = 60`),
so it auto-refreshes live data in the background for anyone viewing — no rebuild
or manual push needed.

`GET /api/refresh` busts the data cache (`revalidateTag`) on demand. A Vercel
cron (`vercel.json`) hits it on a schedule. Notes:

- Vercel **Hobby** caps cron frequency to **once/day** — so the cron is a daily
  backstop; ISR does the real minute-to-minute refreshing for visitors.
- For sub-daily refresh regardless of traffic: on **Pro**, change the cron
  `schedule` to e.g. `*/5 * * * *`; or point a free external cron
  (cron-job.org) at `https://<your-app>/api/refresh`.
- Set a `CRON_SECRET` env var in Vercel to require `Authorization: Bearer` on
  the endpoint (Vercel's cron sends it automatically).

## Live vs. seeding

Before events are scored the API returns a roster, so the site shows **seed
order** with a clear banner and empty event columns. Once CrossFit posts
results, the same components render per-event placements, points, and totals —
re-run `npm run fetch` to pull them in. The dashboard adapts to three modes
derived from the API (`seeding` → `live` → `final`): the tag, KPIs (Top Seed /
Current Leader / Champion + Runner-up), and "Next Event" all change accordingly.

## Seasons (year selector)

`lib/crossfit/competitions.ts` lists the Games seasons the site can show, each
mapping a year to its c3po ids. A **year dropdown** in the top bar switches
seasons via `/?year=YYYY` (the newest listed year is the default at `/`).

- The **leaderboard** is available for every listed year, so a completed season
  (e.g. `?year=2025`) is real, fully-scored data — useful for previewing the
  scored UI outside competition.
- The **CMS schedule and scraped workouts only exist for the current Games**, so
  past seasons render **standings-first**: the Schedule/Workouts tabs and the
  right rail are hidden, and event columns fall back to the leaderboard's own
  ordinals. Add a new season by prepending an entry to the registry.

## Layout

```
app/            layout + one server page per route (/, /schedule, /workouts), globals.css
components/     SiteHeader (nav), LeaderboardView (client — toggles/search),
                ScheduleView, WorkoutsView, shared.tsx (helpers, footer, chrome)
lib/getSnapshot.ts  year resolution + snapshot loading shared by the routes
lib/crossfit/   api.ts (c3po client), workouts.ts (scraper), types.ts
lib/data.ts     reads the /data snapshot
scripts/fetch.ts one-shot data pull
data/           generated JSON snapshot
```
