# MarketSphere Backend API (v2)

FastAPI service backing the MarketSphere globe UI. This is the source of truth for the frontend
— treat `BACKEND_ARCHITECTURE.md` and `API_INFRASTRUCTURE.md` as design rationale, this file as
the actual contract. Interactive docs (always accurate, auto-generated) at `/docs` once running.

## Core model — dual context, panels, stateless chat

- **`scopeConfig`** — driven by globe navigation (`GET /api/scope?region=`). Ephemeral, regenerated every call, never persisted server-side.
- **`workspaceConfig`** — driven by chat `build` queries. Client-held: sent in each `/api/chat` request, only persisted server-side via an explicit `POST /api/layouts` save.
- **`activeView`** — `"scope"` | `"workspace"`, tracked client-side, tells the renderer which config to draw.
- **Chat history IS persisted server-side** (a deliberate deviation from a pure-stateless design — see below) — `POST /api/session` returns a `session_id`; every `/api/chat` call requires it and both the user message and model reply are saved, so a reload doesn't lose the conversation. `workspaceConfig` itself still isn't auto-saved — only history is.

Every route is under `/api`.

## Running locally

```
cd backend
docker compose up -d          # Postgres — if you already have Postgres on :5432 locally, stop it first or remap the container port
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in GEMINI_API_KEY, GUARDIAN_API_KEY, ALPHA_VANTAGE_API_KEY
uvicorn app.main:app --reload --port 8000
python -m scripts.ingest_news --days 3   # populates news_articles — /api/news returns nothing until this runs
```

**Gemini quota note:** the free-tier key used during earlier testing hit a **hard daily cap of 20 requests** on `gemini-flash-latest` (`gemini-3.5-flash`) — not a per-minute throttle, a full-day lockout once exhausted (`google.genai.errors.ClientError`, 429, `quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier`). **The project's key has since moved to a paid tier and this is no longer an active blocker** — leaving this note in place since it's still real, useful context if a different/fresh key is ever swapped in for a demo.

## Routers

| Prefix | Purpose | Status |
|---|---|---|
| `/api/session` | create a session, returns default world `scopeConfig` | **live** |
| `/api/scope` | deterministic scope-config builder from the region registry | **live** |
| `/api/regions` | curated region registry (FIPS, yfinance ticker, TradingView symbol) | **live** |
| `/api/news` | DB-backed news (GDELT + Guardian + Alpha Vantage), per-panel hydration | **live**, requires ingestion run first |
| `/api/market` | DB-cached OHLCV via yfinance, per-panel hydration | **live** |
| `/api/chat` | router: classify → `answer`/`build`/`analyze`, persists history | **live**, not yet load-tested end-to-end due to quota |
| `/api/layouts` | save/list/fetch named workspace configs | **live** |
| `/api/health` | liveness | **live** |

## Endpoints

### `GET /api/health`
`{ "status": "ok" }`

### `POST /api/session`
No body. Creates a session, returns its id plus the default world-scope panel config.
```json
{ "session_id": "uuid", "scopeConfig": { "version": 1, "panels": [ ... ] } }
```

### `GET /api/scope?region=`
`region` omitted or `"world"` → world scope (1 global news panel + all 10 market indices). Otherwise must be one of the 6 continent ids from `/api/scope/continents` → per-country news panels + continent-level news panel + matching market indices. `400` on an unrecognized region.
```json
{ "scopeConfig": { "version": 1, "panels": [ { "id": "p_xxxx", "type": "news"|"market", "title": "...", "rationale": "...", "params": { ... } } ] } }
```
`news` panel params: `{ "country": "JA"|null, "continent": "europe"|null, "query": "...", "timespan": "24h", "max": 40 }`. `market` panel params: `{ "symbol": "^N225", "range": "1mo", "interval": "1d" }`.

### `GET /api/scope/continents`
`[{ "id": "europe", "label": "Europe" }, ...]` — the 6 valid continent ids, source of truth for `region=`.

### `GET /api/regions`
`[{ "region": "Japan (Nikkei 225)", "country_fips": "JA", "yf_ticker": "^N225", "tv_symbol": "TVC:NI225" }, ...]` — 10 curated entries. `tv_symbol` is for the frontend's TradingView widget only; backend never touches TradingView.

### `GET /api/news?continent=&country=&max=`
All params optional; no params = world scope, all sources mixed. `country` accepts either FIPS (`UK`) or ISO2 (`GB`) — translated internally, DB storage is ISO2. Returns **only what's already been ingested** — this is DB-backed, not a live external call.
```json
{ "articles": [ { "source": "guardian"|"alpha_vantage"|"gdelt", "title": "...", "url": "...", "domain": "...", "body": "..."|null, "summary": "..."|null, "image_url": "..."|null, "language": "..."|null, "country": "US"|null, "continent": "north-america"|null, "sentiment_score": 0.3|null, "published_at": "2026-07-11T18:03:00" } ] }
```
`body` is Guardian-only (full text), `summary`/`sentiment_score` Alpha Vantage-only, else `null`.

### `GET /api/market?symbol=&range=&interval=`
`symbol` required (a yfinance ticker, e.g. `^GSPC`). `range` defaults `1mo` (`5d`|`1mo`|`3mo`|`6mo`|`1y`), `interval` defaults `1d`. DB-cached (5 min freshness window) — first call per symbol hits yfinance and stores it, subsequent calls read Postgres. Unknown/delisted symbols fail soft to `{"ohlcv": []}`, never a 500.
```json
{ "symbol": "^GSPC", "ohlcv": [ { "date": "2026-06-11", "open": 7400.1, "high": 7420.5, "low": 7390.2, "close": 7410.0, "volume": 4785840000 } ] }
```

### `POST /api/chat`
```json
{ "session_id": "uuid", "message": "...", "active_view": "scope"|"workspace", "workspace_config": {...}|null, "current_scope": "world"|"europe"|... }
```
`404` if `session_id` unknown. `503` if Gemini is unavailable (quota, key, transient) — safe to retry, nothing is persisted on failure. Response shape depends on classified intent:

- **`answer`** — `text/event-stream` (SSE). Each event: `data: {"type": "text", "text": "..."}` (repeated) then `data: {"type": "done", "citations": [...]}`, or `data: {"type": "error", "message": "..."}` if the stream fails mid-way. Grounded in DB-backed news (no live search tool — see `BACKEND_ARCHITECTURE.md` deviation note if added later). Country/continent context extracted from the message resolves against **any real country** (`entity_resolver.resolve_country_for_news`, ~200 countries via `pycountry`) or a continent id/demonym (`resolve_continent` — "African", "Asian", etc.), not just the 9 flagship market-index countries — falls back to unfiltered world news only if neither resolves.
- **`build`** — plain JSON: `{ "action": "build", "target": "workspace", "config": {...PanelConfig}, "switch_view": true, "notes": "Skipped: 'Wakanda' isn't a recognized country"|null }`. News panels accept any real country or continent id (same broad resolution as `answer`, above) — **not** limited to the market registry. Market panels stay restricted to the 10 registry symbols/tickers, since that's a real data-availability limit, not a resolution gap: every `symbol` is registry-validated with one bounded repair retry before falling back to dropping the panel.
- **`analyze`** — plain JSON: `{ "action": "analyze", "text": "hedged narrative paragraph", "evidence": { "articles_used": ["url", ...], "tone_trend": 0.12, "price_change_pct": -1.4 } | null }`. `evidence` is `null` if the company name couldn't be resolved (curated ~34-company map — see `entity_resolver.py`).

### `POST /api/layouts`
```json
{ "name": "My Workspace", "config": {...PanelConfig}, "session_id": "uuid"|null }
```
→ `{ "id": "uuid", "session_id": "uuid"|null, "name": "...", "config": {...}, "created_at": "...", "updated_at": "..." }`

### `GET /api/layouts?session_id=`
List layouts, optionally filtered by session. Same shape as above, as a list.

### `GET /api/layouts/{layout_id}`
Fetch one. `404` if unknown.

## Known gaps / next steps

- Guardian's section→continent mapping (`guardian_client.py`) is conservative and was built without live network access to verify against Guardian's actual tag API — worth double-checking.
- Market panels (`build` intent and `GET /api/scope`) are hard-limited to the 10 registry symbols — this is a real data-availability gap (no ticker/index data source for most countries), not a resolution bug like the news one below was. Africa specifically has zero market registry entries.

### Fixed since last pass (kept here briefly for anyone tracking against an older copy of this doc)

- ~~Country/continent detection for `answer`'s context only resolves the 9 flagship countries~~ — fixed. Both `answer` and `build` now resolve any real country (`resolve_country_for_news`) or continent id/demonym (`resolve_continent`), not just the market-index 9. Verified live: "What's happening in African markets" now grounds its response in real ingested Nigeria/Egypt articles instead of falling back to unfiltered world news; "show me Nigeria news" now returns a populated panel (`country: "NG"`) instead of an empty one.
- ~~`/api/chat` had not had a full live end-to-end pass across all three intents~~ — done, all three (`answer` streamed, `build`, `analyze`) verified via real HTTP requests returning correct shapes with real data, after the Gemini key was moved off the free tier (was hitting the 20 req/day cap during earlier testing).
