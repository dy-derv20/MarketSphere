# MarketSphere — Frontend

12-hour hackathon project. This file documents **my slice**: the entire
frontend experience — the interactive 3D globe, its hover/click navigation,
the market/news dashboard panel, its wiring to the real backend, and the
Gemini-backed chat assistant UI. Backend implementation itself is a
teammate's scope; this file tracks *my* integration work against it.

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
    │   │   ├── panel/               — PanelList, MarketSection, MarketChart
    │   │   │                          (Phase F, own chart), NewsSection,
    │   │   │                          TradingViewMiniWidget (now unused —
    │   │   │                          kept only as the documented §6
    │   │   │                          fallback), NewsRow, SectionState
    │   │   └── chat/                — FloatingChat (Phase E assistant UI)
    │   ├── lib/
    │   │   ├── api/                 — typed API client: http.ts (shared fetch
    │   │   │                          wrapper), session.ts, scope.ts, regions.ts,
    │   │   │                          news.ts, market.ts, chat.ts, regionsByContinent.ts
    │   │   ├── data/                — countries-110m.json only now; markets.ts/
    │   │   │                          news.ts (Phase C mocks) were deleted once
    │   │   │                          nothing imported them anymore
    │   │   ├── useAppSession.ts     — session create/restore + localStorage
    │   │   ├── useRegions.ts        — fetches /api/regions once, reused per continent
    │   │   ├── useMarket.ts         — fetches /api/market once (Phase F), reused
    │   │   │                          per continent, same pattern as useRegions
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

## ⚠️ Backend moved to v2 — this file's Phase D/E/F notes describe the v1 contract

Everything below "Definition of Done" for Phases D/E/F was written and verified
against the **v1** backend API. The backend has since been rewritten (`API.md`
is the authoritative, current contract — read that before touching any
`lib/api/*` file). Left the Phase D/E/F narrative in place as a historical
record of what was actually verified at the time, not as current truth. The
practical differences that broke the frontend integration, all now fixed:

- `POST /api/session` response shape changed (`scopeConfig` instead of
  `current_scope`/snapshots); `GET /api/session/{id}` was removed then
  re-added with a different shape (now includes persisted chat `messages`).
- `PUT /api/scope/{session_id}` is gone — scope is now `GET /api/scope?region=`,
  returning a dynamic `scopeConfig.panels[]` (news + market panels, each with
  its own fetch params) instead of a fixed `{level, id, label}`.
- `GET /api/news`/`GET /api/market` now take real query params
  (`continent`/`country`/`max` and `symbol`/`range`/`interval` respectively)
  and are meant to be called **per panel**, not once globally. `/api/market`
  now 422s without a `symbol` — this was the single biggest breakage, it
  blocked the Market section entirely on every continent.
- `POST /api/chat/{session_id}` is now `POST /api/chat` (`session_id` moved
  into the body), and the response is no longer a fixed `{role, content,
  created_at}` — it's either an SSE stream (`answer` intent) or one of two
  JSON shapes (`build`/`analyze` intent) depending on what the backend
  classified the message as.
- News/Market are no longer world-scope-only — the backend now returns real
  per-continent (and per-country) data, including Africa, which previously
  had zero coverage. The "Known limitations" entries about this below are
  now stale for News/Market specifically (Africa's *market* registry gap is
  still real — see backend `API.md` — but News now covers all 6 continents).
- `POST /api/chat`'s `answer`/`build` intents used to only resolve the 9
  flagship market-index countries (US/FR/GM/UK/JA/HK/BR/CA/AS) for news
  context/panels — a chat query like "African markets" or "Nigeria news"
  silently fell back to unfiltered world news or an empty panel, no error.
  Fixed backend-side: both now resolve any real country (~200, via
  `pycountry`) or a continent id/demonym ("African" → `africa`). If
  `FloatingChat` or future panel-building UI was built around/tested
  against that narrower behavior, it's worth a quick re-check — the
  response shapes are unchanged, only which queries succeed with real
  (non-empty, non-generic) results.

## Running the backend locally

`DATABASE_URL` has no default and the session/chat/news/market models use
Postgres-specific `UUID`/`JSONB` column types (not swappable for SQLite
without editing backend model code, out of frontend scope). `GEMINI_API_KEY`
also has no default, so the whole FastAPI app fails at import time without
one — this blocks session/scope/news/market too, not just chat.
`NEWS_API_KEY`/`MARKET_API_KEY` are unused/legacy; `GUARDIAN_API_KEY` and
`ALPHA_VANTAGE_API_KEY` are the real new ones (news ingestion, see below) —
harmless blank, but those two sources contribute zero articles without them.

The backend now ships a `docker-compose.yml` for Postgres — this is the
current recommended path, not the manual `brew`/role-creation setup this
section used to document (that was against `.env.example`'s old `user`/
`password` creds, which no longer match — current `.env.example` uses
`marketsphere`/`marketsphere`, matching the compose file):
```
cd backend
docker compose up -d      # if you already run Postgres locally on :5432, stop it first or remap the container port
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in GEMINI_API_KEY at minimum
```
**`CORS_ORIGINS` must not have a trailing slash** (`http://localhost:3000`,
not `.../3000/`) — a trailing slash silently breaks every frontend request:
`Access-Control-Allow-Origin` just doesn't match and the browser blocks the
response. Caught this by testing an actual cross-origin request, not just
`/api/health`, which doesn't care about CORS. Note `uvicorn --reload` only
watches `.py` files — editing `.env` needs a manual process restart to
take effect, it will not hot-reload.

Run with `uvicorn app.main:app --reload --port 8000`. Tables are created
automatically on startup (`Base.metadata.create_all`) — no separate
migration step. Verify with `curl localhost:8000/api/health`, but also
verify an actual cross-origin request (`curl -i -X GET
localhost:8000/api/health -H "Origin: http://localhost:3000"` and check
for the `access-control-allow-origin` response header) — `/api/health`
alone will pass even with CORS totally broken.

**`GET /api/news` returns nothing until you run ingestion — this is new in
v2.** News is now DB-backed (GDELT + Guardian + Alpha Vantage), not a live
call per request. Run `python -m scripts.ingest_news --days 3` after the
server's up (or anytime after) to populate it; re-running is safe/idempotent.
Without this step every continent's News section will correctly show its
real empty state, not an error — but it'll look broken if you don't know why.

**Gemini free-tier quota: 20 requests/day, hard daily cap** (confirmed via
the `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier` in the
429 response body — not a short burst-rate limit, waiting ~60s does not
reliably help). Budget real `/api/chat` testing accordingly. When
exhausted, Gemini returns `google.genai.errors.ClientError` (429) — see
Phase E's note below on why this currently surfaces to the frontend as a
misleading CORS error rather than the clean 503 `API.md` documents.

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
transition (Phase C, done), backend integration (Phase D, done), chat
assistant UI (Phase E, UI done), Market panel own-chart upgrade (Phase F,
done). `/api/perspective` still has no client function or UI — genuinely
deferred, not needed by anything built so far.

### Explicitly Out of Scope
Backend implementation itself, auth, databases (all teammate's scope).
`/api/perspective` UI. Country/state-level scope selection (not yet
supported by the backend). Client-side workarounds for the news/market
world-scope-only gap or the Africa regions gap (see "Known limitations").
Chat message persistence beyond component state, and wiring chat content
to PanelList navigation/highlighting — both explicitly future work. The
tone/divergence overlay described in `FRONTEND_MARKET_PANEL.md` §5 — the
backend's `/api/news` doesn't return `tone_timeline` yet (only
`articles[]`), so there's no live data to feed it; deliberately deferred
rather than built against a field that doesn't exist (see Phase F notes).

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

### Phase E — AI Assistant panel [UI DONE]
- `FloatingChat` (`components/chat/`): a circular trigger fixed
  bottom-left, visible in every `ViewMode`, rendered once in `AppShell`
  alongside the globe/panel — not gated by `showDashboardChrome`.
  Expands into a chat panel via a Framer Motion shared `layoutId`
  (`"chat-shell"`) between the trigger button and the panel container, so
  the circle visually morphs into the panel rather than a fade/slide
  swap. Deliberately distinct from the Market/News cream-card look —
  stays entirely within the dark/teal palette (no new hues), with a
  breathing glow ring on the trigger, a live-status pulse dot in the
  header, bouncing-dot typing indicator (not a spinner), and message
  bubbles distinguished by alignment + a teal vs. neutral tint rather
  than by introducing the light-card treatment.
- `lib/api/chat.ts` — `sendChatMessage(sessionId, message)`, one function
  matching the existing per-endpoint convention, hits
  `POST /api/chat/{session_id}` with `{ message }`, typed via the
  `ChatMessage` shape already in `types/api.ts` (it already matched
  `API.md`'s documented response exactly, so no new type was needed).
- Send flow: optimistic user-message render → `sendChatMessage` →
  append the reply, or render an inline error bubble (styled like
  `SectionState`'s `ErrorState`, not a toast/`alert()`) on failure. No
  retry logic, no persistence beyond component state — `FloatingChat`
  stays mounted for the page's lifetime, so history survives `isOpen`
  toggling and `ViewMode` changes, but not a hard refresh.
- `next.config.ts` now sets `devIndicators.position: "bottom-right"` —
  Next's own dev-mode indicator defaults to bottom-left and was
  physically colliding with the new trigger button (confirmed via a
  failed Playwright click before tracing it to `<nextjs-portal>`
  intercepting pointer events). Dev-only, no effect on production builds.
- **Backend bug found during verification, not fixed here (out of
  frontend scope) — see `backend/app/api/routes/chat.py`:** it only
  catches `google.genai.errors.ServerError` and converts it to the
  documented 503. Gemini's rate-limit response is a different exception
  type, `google.genai.errors.ClientError` (429), which isn't caught —
  it propagates as an unhandled exception, and Starlette's
  `CORSMiddleware` never gets a chance to attach CORS headers to
  responses generated *after* an unhandled exception leaves the route
  (a well-known FastAPI/Starlette gotcha — deliberately-raised
  `HTTPException`s get CORS headers fine; exceptions that bubble past
  the route entirely don't). The practical effect: hitting the free-tier
  quota surfaces to the browser as a misleading CORS error instead of a
  clean 503, even though CORS itself is configured correctly. The
  frontend's error handling degrades gracefully regardless (any failed
  `fetch` — CORS-blocked or otherwise — renders the same inline error
  state), so this isn't user-facing-broken, just confusing to debug
  without backend log access. Worth an `except (ServerError, ClientError)`
  fix backend-side, or catching `ClientError` and checking for 429
  specifically to return a friendlier "rate limited" message.
  **Fixed since this was written** — current `chat.py` catches
  `google.genai.errors.APIError` (the shared base class for both
  `ServerError` and `ClientError`), not just `ServerError`. Verified live:
  a real quota-exhausted request now returns a clean `503`
  (`{"detail": "Gemini is temporarily unavailable, please try again."}`)
  with correct CORS headers, not an unhandled exception. Not sure when
  this landed relative to when this note was written — worth a quick
  browser re-check if the misleading-CORS-error symptom is still assumed
  anywhere in frontend error handling, but the backend side is confirmed
  fine now.

### Phase F — Market Panel: Own Chart [DONE]
Followed the frontend spec in `frontend/FRONTEND_MARKET_PANEL.md`. Replaces
`MarketSection`'s TradingView embeddable widget with a chart rendered on
our own site via **TradingView Lightweight Charts** (open-source,
`lightweight-charts@5.2.0` — `chart.addSeries(CandlestickSeries, opts)`
form, not v4's `addCandlestickSeries()`), fed by real
`GET /api/market` OHLCV.
- `components/panel/MarketChart.tsx` — one candlestick chart per region,
  cream rounded-card styling matching the rest of the panel (not the
  library's dark-theme defaults). `layout.attributionLogo: false` set
  deliberately — leaving TradingView's own logo visible would have
  undercut the entire point of moving off their branded widget.
  De-dupes + ascending-sorts by date defensively before `setData()` (the
  library throws on unordered/repeated timestamps); backend's yfinance
  passthrough hasn't been observed to violate this, but it isn't
  guaranteed. `chart.remove()` runs in the `useEffect` cleanup keyed on
  `[ohlcv]`.
- `lib/useMarket.ts` — fetches `/api/market` once, same "fetch once,
  reuse per continent" pattern as `useRegions` (the endpoint has no
  per-symbol filtering — it always returns all 10 registry series in one
  call; see `API.md`'s documented shape).
- `MarketSection` now matches each region to its series by
  `region.yf_ticker === series.symbol` (both keyed off the same backend
  `REGIONS` list, so this is a real match, not a guess) and combines
  `useRegions` + `useMarket` loading/error state before rendering.
- **This changes a previously-documented known limitation**: Market used
  to bypass `/api/market` entirely via TradingView's live-symbol widget;
  it now depends on `/api/market` directly, so Market is *newly* subject
  to the same world-scope-only gap News already had (see "Known
  limitations", updated below).
- **Fixes the `SP:SPX`-doesn't-render bug** documented under Phase D/Known
  limitations — that was specific to TradingView's free embeddable widget
  refusing that symbol string; our own chart runs on real yfinance OHLCV
  and has no such restriction. Verified live: United States (S&P 500) now
  renders a real candlestick chart under North America.
- Loading/error states reuse the existing `SectionState.tsx` primitives
  (skeleton while either `useRegions` or `useMarket` is loading, shared
  error state if either fails); Africa's empty state is unchanged.
- **Tone/divergence overlay (spec §5) deliberately not built** — the
  backend's `/api/news` doesn't return `tone_timeline` yet, only
  `articles[]` (confirmed against the live schema, not just docs). The
  overlay was the whole reason the spec chose Lightweight Charts over the
  widget, but there's no live data to feed it and backend work is out of
  scope — user explicitly decided to skip it for time rather than block.
  `MarketChart` does not accept a `toneTimeline` prop; add one if/when
  the backend ships it.
- `TradingViewMiniWidget.tsx` intentionally left in the tree, unused —
  it's the spec's documented §6 fallback (chart-only, no-overlay
  contexts), not currently wired to anything.
- Verified against the live local backend in a real browser (Playwright):
  candlesticks render correctly for Europe (4 regions) and North America
  (2 regions, confirming the `SP:SPX` fix); Africa's empty state and the
  News section (both populated and empty-state cases) are unaffected;
  zero console errors across 5 fresh page loads/interactions.
- **Known minor cosmetic artifact, not fixed**: a stray "0" tick fragment
  renders at the bottom-left of each chart's time axis at the panel's
  300px card width. Tried `leftPriceScale.visible: false` — didn't
  resolve it. Not a data or functional bug (all real values render
  correctly); left as a documented rough edge rather than sinking further
  time into an opaque axis-formatting quirk, consistent with this
  project's existing pattern for similar cosmetic-only issues (see
  TradingView widget styling and dev-only console error entries below).

## Known limitations (backend-side, flagged rather than worked around)

- **News and Market are world-scope only.** `GET /api/news` and
  `GET /api/market` have no per-continent filtering yet; `PUT /api/scope`
  populates every session's snapshot from the same world-level data
  regardless of which continent was set. The frontend does NOT fake
  per-continent filtering client-side — News is honestly labeled "World
  markets" in the UI. **As of Phase F, Market is also subject to this in
  practice**: it used to bypass `/api/market` entirely via TradingView's
  live-symbol widget (which is what `API.md`'s note about `/api/market`
  being "for the AI/analytics layer, not the frontend chart" was
  originally about), but the panel now renders its own chart from
  `/api/market` OHLCV directly, per-region filtering done client-side by
  matching `yf_ticker` against the always-full 10-series response, not
  server-side.
- **Africa has zero entries in the backend's region registry**
  (`backend/app/services/scope_service.py`'s `REGIONS` list — 10 entries:
  US, France, Germany, UK, Japan, pan-European Euro Stoxx 50, Hong Kong,
  Brazil, Canada, Australia). Africa's Market section correctly shows an
  honest empty state ("No tracked markets for this region yet.") rather
  than misattributing one of the 10 real regions to it.
- ~~**`tv_symbol: "SP:SPX"` (United States / S&P 500) doesn't render** in
  TradingView's free Mini Symbol Overview embed~~ — **moot as of Phase F.**
  This was specific to the TradingView widget refusing that symbol
  string; the Market panel no longer uses the widget as its primary
  chart (`TradingViewMiniWidget` is now an unused §6 fallback — see Phase
  F), so United States (S&P 500) renders normally via its own
  `yf_ticker`-keyed OHLCV chart. Verified live. Leaving this entry
  struck-through rather than deleted, since it's still relevant if the
  widget fallback is ever wired back up for a chart-only context.
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
- **Gemini free-tier daily quota (20 requests/day) is easy to exhaust
  while testing/demoing `/api/chat`.** Confirmed as a genuine daily cap,
  not a short burst limit (see "Running the backend locally"). A real
  successful round trip was verified (both via `curl` and via the actual
  `FloatingChat` UI, with the backend log showing `200 OK`), and the
  inline error state was verified against the *real* failure this quota
  produces — but be aware the demo could hit this live if `/api/chat` is
  used more than ~20 times in a day on the same API key.
  **Resolved as of the current key** — the project moved to a paid Gemini
  tier, so this specific cap is no longer an active demo risk. Leaving
  this entry (not struck through) since the inline-error-state behavior
  it describes is still real and worth knowing if a different/free key
  ever gets swapped in.
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
- Framer Motion (container morph, panel slide-in, label fades, and now
  `FloatingChat`'s shared-`layoutId` trigger↔panel morph)
- Lucide React (icons) — used for `SectionState`'s error icon
- **TradingView Lightweight Charts** (`lightweight-charts@5.2.0`) — Market
  rows as of Phase F, real candlestick charts off `/api/market` OHLCV.
  `chart.addSeries(CandlestickSeries, opts)` v5 form. See Phase F notes
  for styling/attribution-logo/known-artifact details.
- TradingView embeddable "Mini Symbol Overview" widget
  (`TradingViewMiniWidget.tsx`) — **unused as of Phase F**, kept only as
  the spec's documented fallback for a hypothetical future chart-only,
  no-overlay context. Was used for Market rows through Phase D/E, keyed
  off `tv_symbol` from `GET /api/regions`, script-injected via a
  ref-managed `useEffect`. See "Known limitations" for the styling/symbol
  caveats that applied while it was live.
- Recharts — installed, still unused (Market uses Lightweight Charts, not
  Recharts). Left in `package.json`; not worth removing for a hackathon
  timeline, but genuinely dead code if anyone's auditing.
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

## Definition of Done (Phase E, UI only) — met

1. `FloatingChat` trigger fixed bottom-left, visible in landing,
   transition, and dashboard `ViewMode`s — verified, not just rendered
   unconditionally and assumed
2. Click expands into a chat panel with scrollable history, distinct
   user/assistant message styling, non-spinner loading indicator, and
   inline (not toast) error state
3. `sendChatMessage` hits `POST /api/chat/{session_id}` with the exact
   `API.md`-documented shape — verified via live network-request
   inspection (method, URL pattern, body), not just code review
4. A real message round-trip was confirmed successful (curl + browser,
   both showing a genuine `200` with a real Gemini reply) — not just the
   request being sent
5. The failure path (Gemini free-tier quota exhausted) was also verified
   against a real failure, confirming the inline error state renders
   correctly rather than silently doing nothing
6. Chat history persists across `ViewMode` changes (component stays
   mounted globally) without any new AppShell view-logic being added
   beyond rendering `<FloatingChat sessionId={sessionId} />` once
7. Zero new dependencies; visual design stays within the existing
   palette with zero light-surface bleed outside the panel itself
8. `/api/perspective` and PanelList-content wiring explicitly not
   touched, per scope

## Definition of Done (Phase F) — met, with flagged limitations

1. `MarketSection` renders real candlestick charts from `GET /api/market`
   OHLCV via `MarketChart`/Lightweight Charts, not the TradingView
   embeddable widget — verified live for Europe (4 regions) and North
   America (2 regions), not just that the component compiles
2. Region-to-series matching by `yf_ticker` verified against the live
   `/api/market` response shape (`series[]`, all 10 regions, no
   query-param filtering — confirmed by reading the actual backend route,
   not assumed from the spec doc, which described params that don't
   exist)
3. `SP:SPX` (United States / S&P 500), previously broken under the
   TradingView widget, confirmed rendering correctly under the new chart
   — a real regression check, not just "should be fixed by construction"
4. Africa's empty state and the News section (both real-data and
   real-empty-state cases) confirmed unaffected by this change
5. Loading/error states reuse existing `SectionState` primitives,
   combining `useRegions` + `useMarket` status
6. Zero console errors across 5 fresh browser sessions/interactions
   (Playwright-driven, production build)
7. Tone/divergence overlay (spec §5) explicitly not built — no live
   `tone_timeline` data from `/api/news` to feed it; user decision to
   defer rather than build against a non-existent field, given time
   constraints
8. TradingView attribution logo removed (`attributionLogo: false`) since
   leaving it would have undercut the reason for this change; one
   remaining minor cosmetic artifact (a stray axis-tick fragment at
   300px card width) documented rather than chased further
