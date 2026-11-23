# TEST_RESULTS.md — Restaurant Review BD

Run date: 2026-11-23. App tested with `?asof=2026-11-23` (deterministic "today").

## Unit tests — 124 passed, 0 failed

Command: `node tests/unit.test.js`

Coverage: rating math and rounding, restaurant averages with the min-visits
rule, best-dish tie-breaks, integer-paisa spend totals, dashboard
aggregates, browse search/filter/sort, restaurant and visit validation,
strict import validation (19 malformed cases rejected), date rules,
and Bengali digit rendering.

### Hand-verified numbers (recomputed by hand, asserted in the tests)

1. **Visit score** — ratings (5, 4, 4): (5+4+4)/3 = 13/3 = 4.333… → **4.3**.
   Ratings (5, 5, 4): 14/3 = 4.666… → **4.7**. Ratings (1, 2, 2): 5/3 = 1.666… → **1.7**.
2. **Dashboard fixture** — 3 restaurants; visits: Kacchi Bhai ৳850 (score 4.3)
   + ৳920 (score 4.7), China Garden ৳1,000 (score 4.0):
   - total spend = 85,000 + 92,000 + 100,000 = **277,000 paisa (৳2,770)**
   - overall average = mean(4.3, 4.7, 4.0) = 13.0/3 = 4.333… → **4.3**
   - Kacchi Bhai average = mean(4.3, 4.7) = **4.5**, so it is top-rated
     (the only restaurant with ≥ 2 visits); most-visited with 2 visits.
   - Per cuisine: Bangladeshi 2 visits / avg 4.5; Chinese 1 visit / avg 4.0;
     Thai 0 visits / avg —.
   - Recent visits order: 2026-11-15, 2026-11-10, 2026-11-08.
3. **Best-dish tie-break** — one mention each of "Borhani" and "biryani":
   alphabetical by lowercase name → **"biryani"** wins; the displayed
   spelling is the first-seen one ("Kachchi Biryani" stays capitalised
   when seen first).
4. **Top-rated tie-break** — two restaurants at avg 4.5 with 2 visits each:
   the alphabetically first name wins ("A Biryani" beats "Kacchi Bhai").
5. **Money** — `formatTaka(125000)` = `"1,250"`; `formatTaka(125050)` =
   `"1,250.50"`; `parseSpendTaka("১২৫০")` (Bengali digits) = `125000`;
   `"12.5"`, `"-5"`, `""`, `"abc"` all → `null`.
6. **Import validation** — 19 malformed inputs rejected: bad JSON text,
   wrong app, wrong version, restaurants not an array, duplicate restaurant
   ids, duplicate visit ids, unknown `restaurantId`, rating 6, rating 0,
   negative spend, non-integer spend, future visit date, impossible date
   (2026-02-30), bad phone, unknown extra field, bad cuisine, empty
   restaurant id, visit not an object. A valid import passes and the input
   object is not mutated.

### Repairs during unit testing (1 cycle)

- Two test expectations were wrong, not the logic: the `minRating: 4`
  browse expectation listed results in the wrong order (default sort is
  name, so "China Garden" comes before "Kacchi Bhai"), and a redundant
  "bad JSON string" case used the wrong helper (a valid object was passed
  to the object-mutating helper). Both expectations were corrected;
  no app code changed for these.

## Smoke tests — 61 passed, 0 failed (1280 px) and 61 passed, 0 failed (390 px)

Command: `node tests/smoke.mjs` and `node tests/smoke.mjs 390`

Real headless Chrome (Playwright-cached `headless_shell`, raw CDP over
Node's built-in WebSocket), `file://` URL with `?asof=2026-11-23`.
Checks: 0 console/page errors and 0 failed requests on load; add a
restaurant and two visits through the UI; dashboard numbers against
hand-computed values; validation errors (empty name, future date);
search / filter / sort; second restaurant + delete; demo load/clear;
export → erase → import round-trip; invalid import rejected with data
intact; বাংলা toggle (Bengali digits, persistence across reload);
no horizontal overflow at 390 px.

### Hand-verified numbers in the smoke run

- Visit 1 (5, 4, 4) on 2026-11-20, spend ৳850 → dashboard avg **4.3**,
  spend **৳850**; top-rated empty (needs 2 visits).
- Visit 2 (5, 5, 4) on 2026-11-18, spend ৳920 → visits 2, spend
  **৳1,770**, avg **4.5**; top-rated = Test Biryani House.
- Second restaurant Zebra Cafe, 1 visit, spend ৳100 → visits 3, spend
  **৳1,870**; deleted → back to ৳1,770.
- Demo load (6 restaurants, 9 visits, demo spend
  850+920+150+620+540+2,400+780+1,950+1,680 = **৳9,890**) → 7 restaurants,
  11 visits, spend **৳11,660**; 6 "Demo" badges on cards. Demo clear →
  back to 1 restaurant, 2 visits, ৳1,770.
- Export → erase (typed DELETE) → import round-trip restores exactly
  1 restaurant, 2 visits, ৳1,770.

### Repairs during smoke testing (1 cycle)

- One smoke expectation was wrong, not the app: the "app heading
  rendered" check had been overwritten by a faulty scripted edit and
  compared the heading against the Bengali title. The expectation was
  restored to "Restaurant Review BD"; the app was correct throughout.
  No app code changed for this.

## Static checks

- `grep -rP '[^\x00-\x7F]' --include='*.js' --include='*.html' --include='*.json' --include='*.mjs' .`
  → **zero matches** in app sources (all Bengali text is `\uXXXX`
  escapes in `js/i18n.js`; README.md and this file may contain Bengali/৳
  as docs).
- `node --check` passes for `js/logic.js`, `js/i18n.js`, `js/app.js`,
  `tests/smoke.mjs`.
- No secrets in the code; zero network requests (local files only).
