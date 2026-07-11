# MarketSphere Backend API

FastAPI service backing the MarketSphere globe UI. This doc is kept in sync as the backend is built — treat it as the source of truth for what endpoints exist and their shapes. External data-source rationale (GDELT, yfinance, TradingView) lives in `API_INFRASTRUCTURE.MD`; this doc covers only *our own* endpoints, which is what the frontend actually talks to.

## Running locally

```
cd backend
docker compose up -d          # Postgres, matches .env.example out of the box
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in GEMINI_API_KEY at minimum; DATABASE_URL already matches docker-compose.yml
uvicorn app.main:app --reload --port 8000
```

Base URL (local): `http://localhost:8000`. Every route is under `/api`. Interactive docs (always accurate, auto-generated from the code) at `http://localhost:8000/docs` — useful as a live supplement to this file.

## Session model (reload persistence)

Every browser session is backed by a `Session` row, keyed by a server-generated UUID. Frontend flow:

1. On first load, `POST /api/session` → returns `session_id`. Persist it (e.g. `localStorage`).
2. On subsequent loads, `GET /api/session/{session_id}` → restores chat history + last-viewed scope + last news/market snapshot, so a refresh mid-demo doesn't lose state.
3. Pass `session_id` on `/api/scope`, `/api/chat` calls so the backend can track what the user is currently looking at and keep the chat model's context in sync with it. (`/api/news` and `/api/market` are stateless — see below.)

## Routers

| Prefix | Purpose | Status |
|---|---|---|
| `/api/session` | create/restore a session (chat history + last scope + last snapshots) | **live** |
| `/api/scope` | set/get current continent/country/state scope | **live** (world + continent levels only; country/state land in a later milestone) |
| `/api/regions` | static registry: region → GDELT country code, yfinance ticker, TradingView symbol | **live** |
| `/api/news` | world-scope news headlines (GDELT) | **live** (world scope only; per-country filtering lands with the country-scope milestone) |
| `/api/market` | world-scope OHLCV for a basket of major indices (yfinance) | **live** (world scope only; single-region filtering lands with the country-scope milestone) |
| `/api/chat` | chat with Gemini, context-aware of current scope + news/market snapshot | **live** |
| `/api/perspective` | one-shot structured Gemini framing-contrast + divergence analysis (world scope only) | **live** |
| `/api/health` | liveness check | **live** |

## Endpoints

### `GET /api/health`
Response `200`: `{ "status": "ok" }`

### `POST /api/session`
Creates a new session. No body.

Response `200`:
```json
{
  "session_id": "uuid",
  "current_scope": null,
  "current_news_snapshot": null,
  "current_market_snapshot": null,
  "messages": []
}
```

### `GET /api/session/{session_id}`
Restores a session. `404` if unknown. Response: same shape as above, populated with whatever the session last had.

### `PUT /api/scope/{session_id}`
Sets the current scope for a session.

Request body: `{ "level": "world" | "continent", "id": "europe" }` (`"country"` / `"state"` land in a later milestone)

Response `200`: `{ "level": "continent", "id": "europe", "label": "Europe" }`. `400` if `id` isn't recognized for that `level`.

### `GET /api/scope/{session_id}`
Returns the session's current scope (same shape as above), or `null` if none set yet.

### `GET /api/scope/continents`
No params. Returns the 6 valid continent ids/labels for `PUT /api/scope` (`level: "continent"`):
```json
[
  { "id": "africa", "label": "Africa" },
  { "id": "asia", "label": "Asia" },
  { "id": "europe", "label": "Europe" },
  { "id": "north-america", "label": "North America" },
  { "id": "oceania", "label": "Oceania" },
  { "id": "south-america", "label": "South America" }
]
```
Use this instead of hardcoding continent ids on the frontend — it's the same source `PUT /api/scope` validates against.

### `GET /api/regions`
No params. Returns the full curated region registry:
```json
[
  { "region": "United States (S&P 500)", "country_fips": "US", "yf_ticker": "^GSPC", "tv_symbol": "SP:SPX" },
  { "region": "Europe (Euro Stoxx 50)", "country_fips": null, "yf_ticker": "^STOXX50E", "tv_symbol": "TVC:SX5E" },
  ...
]
```
`tv_symbol` is for the frontend's TradingView widget — the backend never touches TradingView itself.

### `GET /api/news`
No params yet (world scope only). Returns top world economy/markets headlines from the last 24h.
```json
{
  "articles": [
    { "title": "...", "url": "...", "domain": "...", "published_at": "20260711T173000Z", "language": "Chinese", "source_country": "China" }
  ]
}
```
Cached 5 minutes server-side. Fails soft to `{ "articles": [] }` if GDELT is unreachable or throttling — never a 500.

### `GET /api/market`
No params yet (world scope only). Returns OHLCV for all 10 regions in the registry, ~1 month daily bars.
```json
{
  "series": [
    {
      "symbol": "^GSPC",
      "label": "United States (S&P 500)",
      "ohlcv": [ { "date": "2026-06-11", "open": 7400.1, "high": 7420.5, "low": 7390.2, "close": 7410.0, "volume": 123456789 } ]
    }
  ]
}
```
Cached 5 minutes server-side. A ticker that fails to fetch returns `"ohlcv": []` for that series rather than failing the whole response. This is numeric data for the AI/analytics layer — the visual chart on the frontend should use TradingView widgets directly (see `API_INFRASTRUCTURE.MD` §4), not this endpoint.

### `POST /api/chat/{session_id}`
Send a message to the conversational assistant. Session-scoped: reads `current_scope` + `current_news_snapshot` + `current_market_snapshot` (set by the last `PUT /api/scope` call) plus prior chat history to build context, and persists both the user message and the model's reply to `chat_messages`.

Request body: `{ "message": "What's driving the mood in European markets right now?" }`

Response `200`:
```json
{ "role": "model", "content": "...", "created_at": "2026-07-11T18:03:00Z" }
```
`404` if session unknown. `503` if Gemini is temporarily unavailable (message is not persisted in that case — safe to retry).

### `POST /api/perspective`
No body yet (world scope only — country/event-scoped params land with that milestone). Pulls the current world news + market data and asks Gemini for a structured framing-contrast analysis.

Response `200`:
```json
{
  "summary": "...",
  "dominant_framings": [ { "theme": "...", "description": "..." } ],
  "tone_market_divergence": "...",
  "divergence_score": 0.35
}
```
`divergence_score` ranges 0 (narrative and market movement aligned) to 1 (fully divergent). `503` if Gemini is temporarily unavailable.

**Note:** `PUT /api/scope` currently calls the same world-only news/market functions used by `/api/news` and `/api/market` to populate the session snapshot — so right now every scope (world or any continent) sees identical world-level snapshot data. This starts differentiating once continent/country-scoped fetching is built; no frontend changes needed when that happens, the response shapes stay the same.
