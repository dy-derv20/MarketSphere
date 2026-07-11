# News ingestion rework — handoff notes

Summary of changes made on `backend-v2` to replace the live-GDELT-only `/api/news` with a
DB-backed, multi-source, continent-aware pipeline. Written for whoever is working on the
parallel v2 implementation so nothing gets silently clobbered or duplicated.

## ⚠️ Shared working directory — coordinate before touching these files

This branch has **no separate worktree** — these changes were made directly in this checkout,
uncommitted, at the same time as other in-progress work in this same directory (`chat.py`,
`session.py`, `gemini_service.py`, `market_service.py`, `schemas/market.py`,
`schemas/session.py` all changed independently of this work). Nothing has been committed yet,
so `git status`/`git diff` is the source of truth, not just this file.

Files this work modified that a session/scope-focused v2 effort is likely to also touch —
**check `git diff` on these before overwriting, ideally commit-and-merge rather than clobber**:

- `app/main.py` — added one import line for `news_article` model registration.
- `app/config.py` — added two new settings fields.
- `app/services/scope_service.py` — `build_scope_config()` behavior change (extra panel).
- `app/schemas/panel.py` — `NewsParams` gained a field.
- `.env` / `.env.example` — new keys added; **`.env`'s `DATABASE_URL` was also fixed** (was
  `user:password@...`, which doesn't match `docker-compose.yml`'s actual
  `marketsphere:marketsphere` creds and would fail to connect — now corrected). If your
  environment reverts or regenerates `.env`, re-apply this or the DB connection will break.

If it's easier, treat this file as a diff to cherry-pick/reconcile rather than assuming the
working tree will stay exactly as described below.

## Why

1. GDELT's DOC/ArtList mode never returns article body text — headline + link only.
2. `/api/news` was a live external call on every request — a reliability risk for a live demo.
3. Continent scoping for news was badly underpowered: the only continent→country linkage
   anywhere (`scope_service.CONTINENT_FIPS_MAP`) covers 9 countries total, **zero for Africa**
   — an Africa-scoped view got no news panel at all.

## New sources

Added two new external integrations alongside GDELT (kept, extended with a political-keyword
query in addition to the existing finance query):

- **The Guardian Open Platform** — free key, `show-fields=bodyText` gives real full article
  body text. Politics/world/business coverage.
- **Alpha Vantage News & Sentiment** — free key, finance-native, gives summary + sentiment
  score + ticker relevance.

Ingestion is a **one-off CLI script run before a demo**, not a standing job — no scheduler
library was added or exists in `requirements.txt`.

## New dependencies (`requirements.txt`)

`pycountry`, `pycountry-convert` — pure-Python, no network calls, used for country
name/code → continent resolution (replaces the need for a hand-maintained ~200-country table).

## New config keys (`config.py`, `.env.example`, `.env`)

`guardian_api_key`, `alpha_vantage_api_key` added to `Settings`, same pattern as
`news_api_key`/`market_api_key`. **Not yet populated** — user needs to add their own keys to
`.env` before ingestion will pull real Guardian/Alpha Vantage data (GDELT needs no key and
works today).

## New files

```
app/models/news_article.py                    # NewsArticle SQLAlchemy model (new table: news_articles)
app/services/ingestion/__init__.py
app/services/ingestion/geo_tagging.py          # country_to_continent, country_to_iso2, fips_to_continent, fips_to_iso2, FIPS_TO_ISO2
app/services/ingestion/gdelt_client.py         # moved fetch logic out of news_service.py, added POLITICAL_QUERY
app/services/ingestion/guardian_client.py
app/services/ingestion/alpha_vantage_client.py
app/services/ingestion/pipeline.py             # run_ingestion(since, db) -> dict[str, int], upserts via ON CONFLICT
scripts/__init__.py
scripts/ingest_news.py                         # CLI: python -m scripts.ingest_news --days 3
```

## `NewsArticle` model (`app/models/news_article.py`)

```python
class NewsArticle(Base):
    __tablename__ = "news_articles"
    id: Mapped[uuid.UUID]            # PK, uuid4
    source: Mapped[str]              # "guardian" | "alpha_vantage" | "gdelt"
    url: Mapped[str]
    title: Mapped[str]
    body: Mapped[str | None]         # full text — Guardian only
    summary: Mapped[str | None]      # Alpha Vantage only
    domain: Mapped[str | None]
    image_url: Mapped[str | None]
    language: Mapped[str | None]
    country: Mapped[str | None]      # ISO 3166-1 alpha-2, best-effort, nullable
    continent: Mapped[str | None]    # one of scope_service.CONTINENTS ids, or null = global
    topics: Mapped[list | None]      # JSONB
    sentiment_score: Mapped[float | None]  # Alpha Vantage only
    published_at: Mapped[datetime]   # naive UTC, matches app-wide convention
    ingested_at: Mapped[datetime]    # server_default now()
    __table_args__ = (UniqueConstraint("source", "url"),)  # idempotent upsert key
```

Registered in `main.py` (`from app.models import news_article as news_article_models  # noqa: F401`)
for `create_all` pickup — **no Alembic in this repo**, schema changes need this import + a
restart, nothing else.

## Country code system — important for anyone touching geography

`scope_service.REGIONS`/`CONTINENT_FIPS_MAP` use **FIPS 10-4** codes (US, GM, UK, JA, HK, BR,
CA, AS — 9 countries only, for the flagship market indices). Everything ingested by the new
pipeline is tagged with **ISO 3166-1 alpha-2** instead (via `pycountry`, covers all ~200
countries). `geo_tagging.FIPS_TO_ISO2` is the only bridge between the two systems (a 9-entry
dict, since those are the only FIPS codes this app ever emits). `news_service.get_news()`
translates an incoming `country` query param through this map before filtering the DB, so
existing FIPS-code callers (e.g. `scope_service`'s per-country panels) keep working unchanged.
**Do not assume `country` values in `news_articles` are FIPS — they're ISO2.**

## Breaking changes to existing files

- **`app/services/news_service.py`** — completely rewritten. Old `get_news()`/`get_tone_timeline()`
  (live GDELT dict-returning functions) are gone. New signature:
  `async def get_news(db: AsyncSession, continent: str | None, country: str | None, limit: int = 40) -> list[NewsArticle]`
  — queries Postgres only, zero live external calls.
- **`app/api/routes/news.py`** — `GET /api/news?continent=&country=&max=`, now takes
  `db: AsyncSession = Depends(get_db)`. Dropped the old `country`/`query`/`timespan` param shape.
- **`app/schemas/news.py`** — `NewsItem` reshaped: added `source`, `body`, `summary`,
  `image_url`, `continent`, `sentiment_score`; **renamed `source_country` → `country`**.
  `NewsResponse` **dropped `tone_timeline`/`ToneTimelinePoint` entirely** (was GDELT
  `TimelineTone`-mode-specific, no DB equivalent, nothing else referenced it).

  Full current shape, for anyone building against this without diffing the old version:
  ```python
  class NewsItem(BaseModel):
      source: str                    # "guardian" | "alpha_vantage" | "gdelt"
      title: str
      url: str
      domain: str | None
      body: str | None               # full text, Guardian only, else null
      summary: str | None            # Alpha Vantage only, else null
      image_url: str | None
      language: str | None
      country: str | None            # ISO 3166-1 alpha-2, e.g. "US", "NG" — NOT FIPS
      continent: str | None          # "africa"|"asia"|"europe"|"north-america"|"oceania"|"south-america"|null
      sentiment_score: float | None  # Alpha Vantage only, else null
      published_at: datetime

  class NewsResponse(BaseModel):
      articles: list[NewsItem]
  ```
  Example: `GET /api/news?continent=africa` →
  ```json
  {"articles": [{"source": "gdelt", "title": "...", "url": "...", "domain": "...",
    "body": null, "summary": null, "image_url": null, "language": "en",
    "country": "NG", "continent": "africa", "sentiment_score": null,
    "published_at": "2026-07-11T22:37:09.017021"}]}
  ```
  `GET /api/news` (no params) = world scope, all sources mixed, no continent/country filter.
- **`app/services/answer_service.py`** — one-line fix: `a['source_country']` → `a['country']`
  in `_build_context_block`, to match the schema rename. This function isn't wired to any
  route yet (dead code as of this branch) but would have silently broken once someone wires
  up chat.
- **`app/schemas/panel.py`** — `NewsParams` gained a new optional `continent: str | None = None`
  field, additive, existing `country` field untouched.
- **`app/services/scope_service.py`** — `build_scope_config()` now emits **one extra**
  continent-level news `Panel` (`NewsParams(continent=region_id)`) for every continent scope,
  in addition to the existing per-country panels. This is what makes `GET /api/scope?region=africa`
  return a populated news panel instead of none. `CONTINENT_FIPS_MAP`/`REGIONS`/`FIPS_LABELS`
  themselves were **not** touched — still 9-country market-index scope only.

## `API.md` is now stale

Note: `API.md` at repo root already didn't match the actual code before this work started (it
documents a stateful `PUT /api/scope/{session_id}` design that was removed in favor of the
current stateless `GET /api/scope?region=` + `PanelConfig`/panels model, and a `Session` model
that no longer persists `current_scope`/snapshots). This branch adds further drift: the
`/api/news` request/response shape documented there no longer matches
`app/schemas/news.py`. Worth a full doc pass once the v2 API surface settles.

## Environment note (unrelated to this feature, but blocks local testing)

This machine has a native Homebrew Postgres already bound to `127.0.0.1:5432`, so Docker's
Postgres container (`docker-compose.yml`, port `5432:5432`) can't actually bind that port on
the host. `docker-compose.yml` and `.env` are both left at the correct/committed `5432` value —
resolve by either stopping the native Postgres (`brew services stop postgresql`) or remapping
the container's host port permanently.

## Still needed before a real demo run

1. Add real `GUARDIAN_API_KEY` / `ALPHA_VANTAGE_API_KEY` to `.env` (currently blank).
2. Resolve the port 5432 conflict above.
3. `pip install -r requirements.txt` (picks up the two new `pycountry*` deps) if your venv
   predates this change.
4. Restart the app once so `create_all` builds the new `news_articles` table (no Alembic —
   automatic on next startup, but does require a restart if the process is still running from
   before this change).
5. Run `python -m scripts.ingest_news --days 3` to populate `news_articles`.
6. Guardian section→continent mapping in `guardian_client.py` (`SECTION_GEO`) uses a
   conservative, verified-by-inspection set of section ids (`us-news`, `australia-news`,
   `uk-news` mapped; `world`/`politics`/`business` left unclassified/global) — was **not**
   verified against Guardian's live tag API in this session (no network access in the sandbox
   this was built in). Worth double-checking against a real API response once a key is available.

## What was actually verified this session

App boots and connects to Postgres; `create_all` builds `news_articles` alongside the existing
3 tables; ingestion script runs end-to-end without crashing (GDELT/Guardian/Alpha Vantage all
fail soft to empty when network/keys are unavailable — confirmed in a sandbox with no outbound
network access, so live source data itself was **not** verified, only the code paths); upsert
is idempotent (re-run doesn't duplicate rows); `continent`/`country` filters on `/api/news`
work correctly, including the FIPS→ISO2 translation (`?country=UK` correctly matches rows
stored as `GB`); `GET /api/scope?region=africa` now returns a populated news panel where it
previously returned none; `geo_tagging.country_to_continent()` sanity-checked against real
country names (China→asia, Nigeria→africa, South Africa→africa, etc.) and bad input
(empty/garbage → `None`, no crash). All synthetic test rows used for verification were deleted
afterward — `news_articles` is empty and ready for a real ingestion run.
