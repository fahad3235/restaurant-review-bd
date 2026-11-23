# Restaurant Review BD

A personal, offline-first restaurant review log for Bangladesh — bilingual
(English / বাংলা), with no account, no server, and no network requests.
Log the restaurants you visit, rate each visit, and see where your money
and your taste actually go.

Ships **empty by default** — no fake reviews. A clearly-labelled demo set
(6 Dhaka restaurants, 9 visits) can be loaded or cleared from the Data tab.

## Problem

Restaurant opinions live in scattered notes, chats, and memory. When you
want to remember *which* biryani was worth ৳850, *where* the fuchka was
good, or how much you spent eating out last month, there is no simple
private place to look. Public review sites mix strangers' opinions with
ads and do not work offline.

## Features

1. **Restaurant CRUD** — name (required, ≤ 80 chars), area (required, with
   Dhaka-area suggestions), cuisine (Bangladeshi / Chinese / Indian /
   Fast Food / Cafe / Continental / Thai / Other), price range
   (৳ / ৳৳ / ৳৳৳ / ৳৳৳৳), optional phone validated as a Bangladeshi
   mobile (`01[3-9]XXXXXXXX`), notes (≤ 200 chars). Edit and delete
   (delete asks for confirmation).
2. **Visit log per restaurant** — date (no future dates), food / service /
   ambience ratings (1–5 stars each), dishes tried (free text, ≤ 200
   chars), spend in whole taka, notes (≤ 200 chars). Overall visit score
   is the mean of the three ratings, shown to 1 decimal. Visits can be
   edited and deleted.
3. **Dashboard** — total restaurants, total visits, total spend (exact,
   integer-paisa arithmetic), overall average rating, top-rated restaurant
   (minimum 2 visits; ties broken by most visits, then name), most-visited
   restaurant, per-cuisine visit counts and average ratings, and the
   latest 5 visits.
4. **Browse** — search by name, area, or dish; filter by cuisine, price
   range, and minimum average rating; sort by name, average rating,
   visit count, spend, or newest. Each card shows average-rating stars,
   visit count, total spend, last visit date, and best dish (most-mentioned
   dish; ties go to the alphabetically first name).
5. **Data tab** — JSON export (download + on-screen copy), strict import
   validation (wrong app/version, bad types, ratings outside 1–5,
   negative spend, future dates, and duplicate ids are all rejected and
   existing data stays intact), and erase-all guarded by typing `DELETE`.
6. **Demo data** — 6 clearly-labelled demo restaurants with 1–2 demo
   visits each (a biryani house in Dhanmondi, a fuchka stall in Bailey
   Road, and more). Every demo entry carries a visible "Demo" badge;
   load and clear buttons are on the Data tab.
7. **Bilingual + offline** — English/বাংলা toggle persisted in
   `localStorage`, Bengali digits when বাংলা is active, all data stored
   in `localStorage`, zero network requests, responsive down to 390 px,
   and all user text is HTML-escaped before rendering (XSS-safe).

## Stack

- Pure static site: `index.html` + `css/style.css` + `js/app.js` +
  `js/i18n.js` + `js/logic.js`. No build step, no framework, no CDN,
  no external assets.
- `js/logic.js` holds all pure logic (rating math, aggregates, browse,
  validation, import checks) and runs in both the browser and Node.
- Money is stored as **integer paisa** everywhere — no floating-point
  rounding error.
- Deterministic dates: `?asof=YYYY-MM-DD` overrides "today" (used by tests).

## Prerequisites

- Any modern browser, or Node.js 18+ to run the unit tests.
- Headless Chromium (Playwright-cached `headless_shell`) for the smoke
  tests — no npm install needed; the smoke test drives Chrome over CDP
  with Node's built-in WebSocket.

## Install / run

```sh
# Serve locally (any static server works), or just open the file:
python3 -m http.server 8000
# then visit http://localhost:8000/

# Or open directly:
# file://.../restaurant-review-bd/index.html
```

No install step, no environment variables, no secrets.

## Dev commands

```sh
node tests/unit.test.js     # Node unit tests (pure logic + i18n)
node tests/smoke.mjs        # headless-Chrome smoke tests, 1280px
node tests/smoke.mjs 390    # headless-Chrome smoke tests, 390px mobile
node --check js/app.js      # syntax check
```

## Testing

See [`TEST_RESULTS.md`](TEST_RESULTS.md) for real counts and the
hand-verified numbers.

- **Unit tests** (`tests/unit.test.js`): 124 checks — rating math and
  rounding, restaurant averages with the min-visits rule, best-dish
  tie-breaks, integer-paisa spend totals, dashboard aggregates,
  import validation (19 malformed cases rejected), date rules
  (future visits rejected, invalid calendar dates rejected), and
  Bengali digit rendering.
- **Smoke tests** (`tests/smoke.mjs`): 61 checks at 1280 px and 61 at
  390 px, in a real headless Chrome — zero console/page errors, add
  restaurant + visits through the UI, dashboard numbers against
  hand-computed values, search/filter/sort, demo load/clear,
  export → erase → import round-trip, invalid import rejected with
  data intact, বাংলা toggle rendering Bengali digits and persisting
  across reload, and no horizontal overflow at 390 px.

## Deployment

Copy the folder to any static host (GitHub Pages, Netlify, or a plain
web server). There is nothing to build and no server component.

## Limitations

- Data lives in the browser's `localStorage` on one device — there is
  no sync, no account, and clearing browser data deletes the log.
  Export JSON regularly from the Data tab as a backup.
- Import only accepts files exported by this app (same `app` name and
  `version: 1`).
- Spend is whole taka only; paisa amounts are stored exactly but the
  UI only accepts whole-taka input (Bengali digits are accepted too).
- Phone numbers are validated for shape only, not verified as real.
- Dates use the device's local calendar; `?asof=` only overrides the
  "today" used for future-date checks.

## Status

Built 2026-11-23 (MUSE Project Factory run #424, 15:00 slot).
Unit tests 124/124, smoke tests 61/61 at 1280 px and 61/61 at 390 px.
