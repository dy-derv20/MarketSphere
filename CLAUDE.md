# MarketSphere — Frontend

12-hour hackathon project. This file documents **my slice**: the entire
frontend experience — the interactive 3D globe, its hover/click navigation,
the market/news dashboard panel, and its wiring to the real backend.
Backend implementation itself is a teammate's scope; this file tracks *my*
integration work against it.

## Repo Layout

Monorepo. Everything I build lives under `frontend/` (Next.js App Router,
TypeScript), as a sibling to `backend/` (Python/FastAPI). Each subproject
is self-contained with its own dependency manifest and `.gitignore`. Run
all frontend commands from inside `frontend/`, not the repo root.

    MarketSphere/
    ├── backend/                     — teammate's FastAPI backend
    │   ├── API.md                   — AUTHORITATIVE source of truth for backend
    │   │                              endpoints, request/response shapes, session
    │   │                              model (lives here, NOT at repo root — a prior
    │   │                              version of this file had that wrong).
    │   ├── API_INFRASTRUCTURE.md    — external data-source rationale (GDELT/
    │   │                              yfinance/TradingView); API.md is what the
    │   │                              frontend actually needs to read.
    │   └── .venv/, .env             — see "Running the backend locally" below;
    │                                  neither existed when this phase started.
    ├── frontend/                    — my scope: everything below lives here
    │   ├── app/                     — Next.js App Router pages (thin — see AppShell)
    │   ├── components/
    │   │   ├── AppShell.tsx         — orchestrates ViewMode, session bootstrap,
    │   │   │                          renders TitleBar + globe pane + PanelList
    │   │   ├── TitleBar.tsx         — dark chrome bar, dashboard/transition only
    │   │   ├── globe/               — LandingGlobe (globe + hover/click/label/
    │   │   │                          camera + container-resize logic)
    │   │   └── panel/               — PanelList, MarketSection, NewsSection,
    │   │                              TradingViewMiniWidget, NewsRow, SectionState
    │   ├── lib/
    │   │   ├── api/                 — typed API client: http.ts (shared fetch
    │   │   │                          wrapper), session.ts, scope.ts, regions.ts,
    │   │   │                          news.ts, market.ts, regionsByContinent.ts
    │   │   ├── data/                — countries-110m.json only now; markets.ts/
    │   │   │                          news.ts (Phase C mocks) were deleted once
    │   │   │                          nothing imported them anymore
    │   │   ├── useAppSession.ts     — session create/restore + localStorage
    │   │   ├── useRegions.ts        — fetches /api/regions once, reused per continent
    │   │   ├── useNews.ts           — fetches /api/news, adapts to NewsArticle shape
    │   │   ├── parseGdeltTimestamp.ts
    │   │   ├── formatRelativeTime.ts
    │   │   └── transitionTiming.ts  — CONTINENT_TRANSITION_MS, shared by camera +
    │   │                              container morph
    │   ├── types/
    │   │   ├── globe.ts             — ViewMode, ContinentId, GeoJSON types
    │   │   ├── panel.ts             — NewsArticle (app-level shape NewsRow renders)
    │   │   └── api.ts               — mirrors API.md's response shapes exactly
    │   ├── public/textures/         — self-hosted globe textures (no CDN deps)
    │   ├── .env.local               — NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
    │   └── docs/reference/          — Phase A/B design reference screenshots
    ├── continent click design.png   — visual reference for the post-selection
    │                                   dashboard state (layout/chrome/panel content
    │                                   only — see Phase C notes for what's authoritative)
    └── CLAUDE.md                    — this file

## Running the backend locally

Not runnable as handed off — no `.env` existed (only `.env.example`), no
Python venv, no local PostgreSQL. `DATABASE_URL` has no default and the
session/chat models use Postgres-specific `UUID`/`JSONB` column types (not
swappable for SQLite without editing backend model code, which is out of
frontend scope). `GEMINI_API_KEY` also has no default, so the whole FastAPI
app fails at import time without one — this blocks session/scope/news/market
too, not just chat. `NEWS_API_KEY`/`MARKET_API_KEY` are harmless to leave
blank: the real `news_service.py` (GDELT, no auth) and `market_service.py`
(yfinance, no auth) code doesn't actually read either one.

Set up once per machine:
```
brew install postgresql@16
brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb marketsphere
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```
Then create `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://<your-macos-username>@localhost:5432/marketsphere
GEMINI_API_KEY=<a real key — chat/perspective 503 without one, fine for now>
NEWS_API_KEY=
MARKET_API_KEY=
CORS_ORIGINS=http://localhost:3000
```
Run with `uvicorn app.main:app --reload --port 8000`. Tables are created
automatically on startup (`Base.metadata.create_all`) — no separate
migration step. Verify with `curl localhost:8000/api/health`.

## Project Vision

MarketSphere replaces the typical financial-app layout (lists, sidebars,
charts) with a full-screen interactive 3D globe as the primary navigation
surface. Users explore world markets by rotating/clicking a globe;
selecting a continent morphs the globe into a smaller framed view on the
left while a Market + News panel (PanelList) slides in on the right, now
backed by real data (session-tracked, live TradingView charts, real news).
The globe is never just decoration — it stays visible and interactive even
after a continent is selected.

## My Scope

Full frontend: globe navigation (Phases A/B, done), camera/dashboard
transition (Phase C, done), backend integration (Phase D, done). Chat/AI
assistant UI is a future phase — `/api/chat` and `/api/perspective` exist
backend-side already, but no client functions or UI were built for them
this session (kept the API client scoped to exactly the six endpoints
actually consumed: createSession, getSession, setScope, getRegions,
getNews, getMarket).

### Explicitly Out of Scope
Backend implementation itself, auth, databases (all teammate's scope).
Chat/AI assistant UI (Phase E). Country/state-level scope selection (not
yet supported by the backend). Client-side workarounds for the news/market
world-scope-only gap or the Africa regions gap (see "Known limitations").

## Build Phases

### Phase A — Landing Globe [DONE]
Full-screen dark globe, photorealistic self-hosted texture, atmosphere
glow, auto-rotating on load, permanently stops on first drag/scroll
interaction. Minimal UI only (title + subtitle) — hidden once a continent
is locked (see Phase C).

### Phase B — Hover/Click Interaction, Continent-Level [DONE]
Six selectable continents (Antarctica excluded). Hovering any country
resolves to and highlights its full continent via an accessor-function
pattern on `polygonCapColor` (no array reassignment). Continent name
renders anchored to the landmass in 3D space, tracks through rotation,
hides when off-camera. Click locks the highlight/label and fires
`onContinentSelect(continentId)`. Hover-preview-after-lock is frozen once
a continent is locked (`isLockedRef`).

### Phase C — Camera Animation + Dashboard Morph [DONE]
Camera `pointOfView()` animation and container morph run concurrently off
one shared `CONTINENT_TRANSITION_MS` constant. `ResizeObserver`-driven
WebGL canvas resize keeps the draw buffer in sync with the animating panel
width — zero stretch artifacts, all 6 continents. Globe stays interactive
and preserves orientation throughout.

### Phase D — Backend Integration [DONE]
- `lib/api/` — typed client, one function per endpoint used (session,
  scope, regions, news, market). Verified against a live local backend at
  every step, not just against the docs.
- Session: `POST /api/session` on first load, `session_id` persisted to
  `localStorage`, `GET /api/session/{id}` restores on reload.
  `PUT /api/scope/{session_id}` fires as a fire-and-forget side effect
  inside the existing `onContinentSelect` flow — no new UI event.
- Market: real TradingView "Mini Symbol Overview" widgets, keyed off
  `tv_symbol` from `GET /api/regions`, grouped by continent via each
  region's `country_fips` code (`lib/api/regionsByContinent.ts` — a
  concrete, data-derived mapping, not a guess; see "Known limitations"
  for the one continent it can't cover).
- News: real headlines from `GET /api/news`, adapted to the existing
  `NewsArticle` shape so `NewsRow` needed zero changes. Labeled "World
  markets" in the section header since the data is honestly world-scope,
  not continent-specific (see "Known limitations").
- Loading (skeleton cards, not a spinner), empty (real case — GDELT
  returns `{"articles": []}` when it fails or throttles, and Africa
  genuinely has no regions), and error states implemented for both
  network-backed sections via `components/panel/SectionState.tsx`.
- **A real, pre-existing bug found and fixed along the way, unrelated to
  Phase D's own scope**: `handleGlobeReady` assumed `globeRef.current` was
  already populated by the time `onGlobeReady` fired. This is a genuine
  race — react-globe.gl's ready-callback and React's ref attachment aren't
  strictly ordered — and it was silently losing the race intermittently in
  **production builds** (`next build && next start`), which no prior
  session had ever tested against (only `npm run dev`, whose inherent
  slowness happened to always mask it). When it lost the race, auto-rotate
  and the interaction-stop listener silently never got wired up at all —
  the globe just sat there static. Fixed with a bounded
  `requestAnimationFrame` retry in `handleGlobeReady`. Verified 8/8 clean
  runs against a production build after the fix (previously intermittent
  — sometimes passed, sometimes failed, across otherwise-identical runs).
  **Worth remembering: test against `next build && next start` occasionally,
  not just `next dev` — they can genuinely behave differently.**

### Phase E (future) — AI Assistant panel
`/api/chat` and `/api/perspective` already exist backend-side. Building
the UI to consume them is future work, not this phase.

## Known limitations (backend-side, flagged rather than worked around)

- **News and Market are world-scope only.** `GET /api/news` and
  `GET /api/market` have no per-continent filtering yet; `PUT /api/scope`
  populates every session's snapshot from the same world-level data
  regardless of which continent was set. The frontend does NOT fake
  per-continent filtering client-side — News is honestly labeled "World
  markets" in the UI. (Market is *not* subject to this limitation in
  practice, since it uses TradingView widgets fetching live per-symbol
  data directly, bypassing `/api/market` entirely — see `API.md`'s own
  note that `/api/market` is for the AI/analytics layer, not the frontend
  chart.)
- **Africa has zero entries in the backend's region registry**
  (`backend/app/services/scope_service.py`'s `REGIONS` list — 10 entries:
  US, France, Germany, UK, Japan, pan-European Euro Stoxx 50, Hong Kong,
  Brazil, Canada, Australia). Africa's Market section correctly shows an
  honest empty state ("No tracked markets for this region yet.") rather
  than misattributing one of the 10 real regions to it.
- **`tv_symbol: "SP:SPX"` (United States / S&P 500) doesn't render** in
  TradingView's free Mini Symbol Overview embed — it shows "This symbol is
  only available on TradingView" instead of a chart. This is North
  America's most-clicked continent's primary index, so worth prioritizing.
  Not something the frontend can fix by picking a different symbol itself
  (that would silently diverge from what the backend registry says) —
  flagging back for the backend teammate to check whether `SP:SPX` is the
  right embeddable-widget symbol string, or whether it needs a different
  exchange prefix (e.g. a `TVC:`-style one, like the other index entries
  in the registry use).
- **GDELT news content doesn't reliably match "economy/markets" intent.**
  Live headlines observed during testing included a fishing tournament, a
  Brazilian political opinion piece, and mixed-language local news — the
  `(economy OR markets OR stocks OR finance)` GDELT query is apparently
  matching too broadly. This is backend query/data-quality, not a
  frontend bug — the frontend renders exactly what `/api/news` returns,
  faithfully. Not filtered or worked around client-side.
- **TradingView widget styling doesn't fully match the design language,
  and this is visible, not just theoretical.** Symbols that do render
  (e.g. Canada/TSX) show TradingView's own white background, bold
  sans-serif font, colored badges/icons — a real, visible clash against
  the app's cream-card/muted aesthetic. `isTransparent: true` and
  `colorTheme: "light"` were set to get as close a match as possible, but
  the rest of the widget's internal chrome (fonts, icons, accent colors,
  branding) is inside a cross-origin iframe the frontend has no styling
  access to. This is an inherent tradeoff of using the free embeddable
  widget rather than the paid Charting Library, not something more CSS
  can fix.
- **TradingView `querySelector` console errors in `npm run dev` only.**
  React Strict Mode's dev-only double-invoke (mount → cleanup → mount)
  races against `TradingViewMiniWidget`'s async external `<script>` —
  confirmed via a production build test that this does NOT happen outside
  dev mode (0 errors, all widgets render correctly). Documented rather
  than "fixed" — building a robust guard against an opaque third-party
  script's own internal timing wasn't worth the engineering cost for a
  dev-only cosmetic issue with zero functional impact.

## Tech Stack

Do not introduce alternatives without discussion.

- Next.js (App Router), React, TypeScript
- Tailwind CSS
- react-globe.gl (wraps three.js + d3-geo) + three.js
- Natural Earth GeoJSON, **110m resolution** — self-hosted, not CDN-loaded
- Framer Motion (container morph, panel slide-in, label fades)
- Lucide React (icons) — used for `SectionState`'s error icon
- TradingView embeddable "Mini Symbol Overview" widget — for Market rows,
  script-injected via a ref-managed `useEffect` (not rendered through
  JSX `<script>`), keyed off `tv_symbol` from `GET /api/regions`. See
  "Known limitations" for the styling/symbol caveats.
- Recharts — installed, still unused (Market uses TradingView directly,
  not a custom chart). Left in `package.json`; not worth removing for a
  hackathon timeline, but genuinely dead code if anyone's auditing.
- `fetch` (native) for the API client layer — no data-fetching library
  (SWR/React Query) was needed for this scope.

## Critical Implementation Details

- Globe component dynamically imported with SSR disabled:
  `const Globe = dynamic(() => import('react-globe.gl'), { ssr: false })`
- All globe textures are self-hosted in `frontend/public/` — no unpinned
  CDN asset URLs.
- Continent highlighting uses an accessor-function pattern for
  `polygonCapColor`/`polygonStrokeColor`/`polygonAltitude`, memoized on
  `[activeContinent, fadeProgress]` — never reassigns the polygon array.
- `handleGlobeReady` retries via `requestAnimationFrame` (bounded, ~1s)
  rather than assuming `globeRef.current` is populated on the first call —
  see Phase D's bug note above.
- Continent label position is computed via `getScreenCoords(lat, lng)`
  from a per-continent centroid, updated every frame the globe moves via
  `onZoom` plus a dedicated rAF loop during the camera transition (since
  `pointOfView()`'s own tween isn't confirmed to dispatch the
  `OrbitControls` "change" event `onZoom` relies on).
- Container/canvas resize uses `ResizeObserver`, not `window.resize`.
- View state is a discriminated union: `type ViewMode = "landing" |
  "transition" | "dashboard"`, owned by `AppShell`.
- API client (`lib/api/`) is one typed function per endpoint, not
  scattered raw `fetch` calls in components. `types/api.ts` mirrors
  `API.md`'s documented shapes exactly.
- Continent ↔ backend scope-id mapping (`lib/api/scope.ts`) and
  continent ↔ region mapping (`lib/api/regionsByContinent.ts`) are both
  derived from real backend data (`CONTINENTS` dict / `country_fips`
  codes in `scope_service.py`), verified against the live `/api/regions`
  response — not guessed.
- `useMarketIndexes`/`useNewsArticles` (Phase C's mock-data hook shape)
  are gone — `MarketSection`/`NewsSection` now call `useRegions()`/
  `useNews()` directly, which were already designed to slot into that
  same "hook returns exactly what the UI needs" pattern.

## Design Language

- Base: black/near-black (`#0a0e14`, `#050708`), dark navy panel
  (`#0d1219`). No light surfaces except Market/News cards.
- Cards: light/cream (`#f4f2ea`), rounded corners, no border, no shadow.
- Accent: teal/green (`#12b886`, `#7fe0c4`, `#5ad1e0`) for highlights and
  positive values. Red (`#e2554f`) for negative values, also reused
  (sparingly, low-opacity) for the error state.
- No gradients. Flat fills only. Cinematic but not slow.
- Loading state: skeleton cards (`animate-pulse`, translucent cream on
  dark), not a spinner. Empty/error states: same rounded-card language as
  the rest of the panel, not generic browser text.

## Definition of Done (Phase D) — met, with flagged limitations

1. Session created/restored per `API.md`'s session model; `session_id`
   persisted across reloads — verified via network-request inspection,
   not just reading the code
2. `PUT /api/scope` fires on continent selection with the correct
   lowercase-hyphenated payload — verified against the live database
   state after the call, not just that the request was sent
3. News section shows real data from `GET /api/news`, honestly labeled
   "World markets" rather than implying continent-specificity
4. Market section integrates real TradingView widgets keyed off
   `tv_symbol`, grouped by continent via a data-derived mapping; Africa
   (which has no registry entries) shows an honest empty state
5. Loading, empty, and error states implemented for both network-backed
   sections, visually consistent with the existing design language
6. All Phase A/B/C UI, layout, and animation behavior unchanged — plus a
   pre-existing production-only auto-rotate race condition was found and
   fixed along the way (see Phase D notes)
7. Known backend limitations (world-scope-only news, Africa regions gap,
   the `SP:SPX` symbol issue, GDELT content relevance) are documented
   here and not silently worked around
8. Implementation done and verified in independent phases against a live
   local backend throughout (client layer → session/scope → regions/
   TradingView → news → full 6-continent regression sweep), not one
   large unverified change
