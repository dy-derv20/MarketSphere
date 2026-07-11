# MarketSphere Backend API

FastAPI service backing the MarketSphere globe UI. This doc is kept in sync as the backend is built — treat it as the source of truth for what endpoints exist and their shapes.

## Running locally

```
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, GEMINI_API_KEY, NEWS_API_KEY, MARKET_API_KEY
uvicorn app.main:app --reload --port 8000
```

Base URL (local): `http://localhost:8000`

## Session model (reload persistence)

Every browser session is backed by a `Session` row, keyed by a server-generated UUID. Frontend flow:

1. On first load, `POST /session` → returns `session_id`. Persist it (e.g. `localStorage`).
2. On subsequent loads, `GET /session/{session_id}` → restores chat history + last-viewed scope + last news/market snapshot, so a refresh mid-demo doesn't lose state.
3. Pass `session_id` on `/scope`, `/news`, `/market`, `/chat` calls so the backend can track what the user is currently looking at and keep the chat model's context in sync with it.

## Routers

| Prefix | Purpose | Status |
|---|---|---|
| `/session` | create/restore a session (chat history + last scope + last snapshots) | **live** |
| `/scope` | set/get current continent/country/state scope | **live** (world + continent levels only; country/state land in a later milestone) |
| `/news` | news headlines for current scope | scaffolded, no endpoints yet — pending news data source decision |
| `/market` | market/index data for current scope | scaffolded, no endpoints yet — pending market data source decision |
| `/chat` | chat with Gemini, context-aware of current scope + news/market snapshot | scaffolded, no endpoints yet |

## Endpoints

### `POST /session`
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

### `GET /session/{session_id}`
Restores a session. `404` if unknown.

Response `200`: same shape as above, populated with whatever the session last had.

### `PUT /scope/{session_id}`
Sets the current scope for a session.

Request body:
```json
{ "level": "world" | "continent", "id": "europe" }
```
(`level: "country"` / `"state"` and their `id` values land when that milestone is built.)

Response `200`:
```json
{ "level": "continent", "id": "europe", "label": "Europe" }
```
`400` if `id` isn't a recognized value for that `level`.

### `GET /scope/{session_id}`
Returns the session's current scope (same shape as above), or `null` if none has been set yet.
