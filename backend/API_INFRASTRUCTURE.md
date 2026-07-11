# API Infrastructure Specification

**Project:** Multi-Perspective Market & News Globe (MarketSphere)
**Audience:** Backend build agent (FastAPI + Python)
**Goal of this doc:** Define every external data source, the exact data the app consumes, the specific endpoints we care about, and the rationale for the data layer, so the backend can be built cleanly without guesswork.

---

## 1. What the application needs (data requirements)

The app centers on a 3D globe. The user scopes **world → continent (camera preset) → country**, and for the selected country three data surfaces update, plus an AI layer:

| Surface | Data required | Source |
|---|---|---|
| **News panel** | Recent articles about the selected country/event, with title, URL, source, date, source country, language, and article **tone** | GDELT DOC 2.0 |
| **Market panel — visual chart** | A live, embeddable market chart for the country's representative index | **TradingView widgets (frontend only — no backend involvement)** |
| **Market panel — numbers** | Raw OHLCV time series for the country's representative index (for AI analysis, the divergence metric, and exposure math) | yfinance via OpenBB |
| **Perspective panel (AI)** | Consumes news (framings + tone), market numbers, and optionally primary-source documents; produces framing contrast + computed analytics | Gemini API (calls the above) |
| **Ground-truth layer (Phase 2 / stretch)** | Primary financial documents (10-K / 8-K / FOMC text) to check narratives against | OpenBB → SEC provider; FRED |

**Important architectural split:** the *visual* market chart is rendered client-side by TradingView widgets and requires **no backend endpoint and no market-data API key**. The backend only needs to serve **numeric** OHLCV data (for the AI/analytics layer). Do not build a charting data pipeline for the visual — that is handled entirely on the frontend.

---

## 2. Source A — GDELT DOC 2.0 API (news + tone)

Primary news/framing source. **Free, no API key, no auth.** Global coverage, filterable by source country and language, updates roughly every 15 minutes.

**Base endpoint (single GET):**
```
GET https://api.gdeltproject.org/api/v2/doc/doc
```

### Query parameters we care about

| Param | Purpose | Notes / values |
|---|---|---|
| `query` | Search string + operators | Required. See operators below. |
| `mode` | Response type | `ArtList` (article list — main use), `TimelineTone` (avg tone over time — for tone overlay), `ToneChart` (tone histogram), `TimelineVol` (coverage volume) |
| `format` | Output format | Always `json` |
| `timespan` | Rolling lookback window | e.g. `15min`, `1h`, `24h`, `3d`, `1w`, `1m` (max ~3 months) |
| `startdatetime` / `enddatetime` | Absolute UTC window (alt to timespan) | `YYYYMMDDHHMMSS` |
| `maxrecords` | Cap results (ArtList) | 1–250 |
| `sort` | Ordering | `DateDesc` (default), `DateAsc`, `ToneDesc`, `ToneAsc`, `HybridRel` |

### Query operators (go inside `query`)
- `sourcecountry:FR` — filter by publishing country. **Uses FIPS 10-4 codes, not ISO** (see §5).
- `sourcelang:french` — filter by language (accepts language name or code; verify against installed behavior — see §5).
- `"exact phrase"` — quoted phrase match.
- `(a OR b)` — boolean OR; space = AND.
- `tone>2` / `tone<-2` / `toneabs>5` — filter by article sentiment.
- `theme:ECON_STOCKMARKET` — GKG theme filter (useful to constrain to finance coverage).
- `domain:reuters.com` — restrict to a domain.

### `mode=ArtList` JSON response shape
```json
{
  "articles": [
    {
      "url": "https://...",
      "url_mobile": "",
      "title": "…",
      "seendate": "20260711T120000Z",
      "socialimage": "https://...",
      "domain": "example.fr",
      "language": "French",
      "sourcecountry": "France"
    }
  ]
}
```

### `mode=TimelineTone` — returns a dated series of average tone. Use this to overlay "narrative sentiment vs. market move" and to feed the divergence metric.

### Example calls
```
# Finance-related articles published in France, last 24h, most recent first:
https://api.gdeltproject.org/api/v2/doc/doc?query=(economy OR market OR stocks) sourcecountry:FR&mode=ArtList&format=json&timespan=24h&maxrecords=50&sort=DateDesc

# Tone timeline for an event across German sources over the last week:
https://api.gdeltproject.org/api/v2/doc/doc?query=inflation sourcecountry:GM&mode=TimelineTone&format=json&timespan=1w
```

### GDELT operational notes (build these in)
- **No official rate limit is published, but it throttles aggressively.** Self-limit to ~1 request / 5 seconds; add retry-with-backoff.
- It occasionally returns **malformed JSON or an HTML error page** on odd queries. Wrap every call in `try/except`, validate that the body parses as JSON, and fall back gracefully.
- **Returns article metadata + URLs, not full body text.** For framing analysis, pass titles + snippets to Gemini, and optionally fetch a handful of full article bodies separately (or use Gemini's URL-context tool on the frontend of that pipeline).
- **Cache** every response keyed by `(query, country, mode, timespan)`.

---

## 3. Source B — yfinance via OpenBB (market numbers)

Numeric OHLCV time series for representative indices, consumed by the AI/analytics layer (divergence metric, exposure math, scenarios). **Free, no key.**

### Why yfinance *through* OpenBB (rationale requested)
- **One interface, swappable providers.** OpenBB standardizes financial data behind a single call signature. We use `provider="yfinance"` now (free, no key, global index coverage), but can switch to `polygon`, `fmp`, `intrinio`, etc. by changing one parameter — no rewrite if we outgrow the free source.
- **Pandas-native, clean output.** Calls return an OBBject; `.to_df()` gives a ready DataFrame — ideal for feeding Gemini's code-execution layer and our own metrics without parsing glue.
- **It unifies our *other* future needs too.** The same library wraps **SEC/EDGAR filings** and **FRED macro** (the Phase-2 ground-truth layer), so one dependency covers markets + filings + macro.
- **Caveats to respect:** yfinance is *unofficial* (can break without notice), data is **≥15-min delayed** (acceptable — we already frame market data as "delayed"), it is **snapshot/historical, not real-time streaming** (poll, don't stream), and OpenBB is **AGPLv3** (fine for a hackathon).
- **Fallback:** if OpenBB's index-symbol conventions cause friction, call `yfinance` **directly** (`yf.Ticker("^GSPC").history(...)`) — it accepts the caret tickers in §5 cleanly. Keep this as the escape hatch.

### Environment
```
# Python 3.9–3.12 required by OpenBB
pip install openbb-core openbb-yfinance   # lightweight; avoids the full meta-package bloat
pip install yfinance                       # direct fallback
```

### Endpoints (Python methods) we care about
```python
from openbb import obb

# Index historical OHLCV (primary use):
obb.index.price.historical(
    symbol="^GSPC", provider="yfinance", interval="1d",
    start_date="2026-01-01", end_date="2026-07-11"
).to_df()

# Equity historical OHLCV (for the exposure/holdings feature):
obb.equity.price.historical(
    symbol="AAPL", provider="yfinance", interval="1d",
    start_date="2026-01-01", end_date="2026-07-11"
).to_df()

# Latest quote:
obb.equity.price.quote(symbol="AAPL", provider="yfinance").to_df()
```
> **Verify method signatures against the installed OpenBB version** — the platform's API surface evolves between releases. If `obb.index.price.historical` rejects a caret symbol, fall back to direct yfinance for indices.

### Direct yfinance fallback
```python
import yfinance as yf
yf.Ticker("^GSPC").history(period="1mo", interval="1d")  # DataFrame with OHLCV
```

### Phase-2 / stretch (same library — do NOT build for MVP unless core is done)
```python
# SEC filings (ground-truth layer):
obb.equity.fundamental.filings(symbol="AAPL", provider="sec")
obb.equity.fundamental.management_discussion_analysis(symbol="AAPL", provider="sec")

# FRED macro (requires free FRED API key in env):
obb.economy.fred_series(symbol="CPIAUCSL", provider="fred")
```

---

## 4. Source C — TradingView widgets (visual chart — FRONTEND ONLY)

**No backend work required.** Documented here only so the backend agent does not build a redundant charting-data pipeline.

- Free, embeddable, no API key. Rendered client-side (React wrapper: `react-ts-tradingview-widgets`, or raw embed script).
- Widgets used: **Advanced Real-Time Chart** (main panel) and optionally **Market Overview**.
- The frontend passes a **TradingView symbol** per region (see §5). The backend never touches this.

---

## 5. Reference tables — region → symbols & country codes

The backend should expose a **region registry** (see §6, `GET /api/regions`) built from this table. It maps a country/continent to: its GDELT source-country FIPS code, its yfinance index ticker (backend numbers), and its TradingView symbol (frontend chart).

| Region | GDELT country (FIPS) | yfinance index ticker | TradingView symbol* |
|---|---|---|---|
| United States (S&P 500) | `US` | `^GSPC` | `SP:SPX` |
| France (CAC 40) | `FR` | `^FCHI` | `EURONEXT:PX1` |
| Germany (DAX) | `GM` | `^GDAXI` | `XETR:DAX` |
| United Kingdom (FTSE 100) | `UK` | `^FTSE` | `TVC:UKX` |
| Japan (Nikkei 225) | `JA` | `^N225` | `TVC:NI225` |
| Europe (Euro Stoxx 50) | — | `^STOXX50E` | `TVC:SX5E` |
| Hong Kong (Hang Seng) | `HK` | `^HSI` | `TVC:HSI` |
| Brazil (Bovespa) | `BR` | `^BVSP` | `BMFBOVESPA:IBOV` |
| Canada (TSX) | `CA` | `^GSPTSE` | `TSX:TSX` |
| Australia (ASX 200) | `AS` | `^AXJO` | `ASX:XJO` |

\* **TradingView symbols must be confirmed via TradingView's symbol search** — exchange prefixes vary and guessing wastes time. The yfinance caret tickers are reliable as listed.

**Notes on codes:**
- GDELT `sourcecountry` uses **FIPS 10-4** codes (Germany = `GM`, Japan = `JA`), **not** ISO-3166 (`DE`, `JP`). Do not assume ISO.
- GDELT `sourcelang` examples: `english`/`eng`, `french`/`fra`, `german`/`deu`, `japanese`/`jpn`. Confirm the exact accepted form during integration.

---

## 6. Backend service surface (our own FastAPI endpoints)

The frontend consumes only these. All external calls happen server-side (keeps keys off the client and avoids CORS; TradingView is the sole client-side exception).

| Method | Path | Purpose | Returns |
|---|---|---|---|
| `GET` | `/api/health` | Liveness check | `{status}` |
| `GET` | `/api/regions` | Region registry from §5 | list of `{region, country_fips, yf_ticker, tv_symbol}` |
| `GET` | `/api/news` | GDELT ArtList + tone for a region/event | normalized `{articles[], tone_timeline[]}` |
| `GET` | `/api/market` | OHLCV series via OpenBB/yfinance | `{symbol, ohlcv[]}` |
| `POST` | `/api/perspective` | Gemini framing-contrast + analytics | structured JSON (framings, divergence, optional exposure) |

**Suggested params:**
- `/api/news?country=FR&query=<terms>&timespan=24h&max=50`
- `/api/market?symbol=^FCHI&range=1mo&interval=1d`
- `/api/perspective` body: `{ "country": "FR", "query": "<event>", "holdings": [ ... optional ... ] }`

**Normalization:** transform GDELT's raw `articles` into a stable internal schema (don't leak GDELT field quirks to the frontend). Same for OHLCV — emit a consistent `{date, open, high, low, close, volume}` shape regardless of provider.

---

## 7. Gemini integration (where the data flows)

The backend calls the Gemini API from the `/api/perspective` handler. Relevant capabilities (SDK: `pip install google-genai`):
- **Structured output** (`response_schema`) — force framings/claims/scores into JSON the UI renders.
- **Code execution** — run Python on the OHLCV + tone series to compute the divergence metric, exposure, and scenario math (this is the "analyst, not chatbot" layer).
- **Grounding with Google Search** — used by the fact-check/ground-truth step.
- **Function calling** — optional: let the model pull a specific `/api/market` or `/api/news` slice on demand.

Keep prompts and schemas in a dedicated module; do not inline them in route handlers.

---

## 8. Build guidance (cross-cutting)

- **All external HTTP** (GDELT, any REST data provider) goes through the backend using `httpx`, never the browser.
- **Caching is mandatory** for GDELT and market pulls — in-memory TTL cache keyed by request params is enough for the MVP.
- **Pre-warm the demo path on startup:** fetch and cache 2–3 target countries + one hero event so a live demo never depends on a cold call or a rate limit.
- **Fail soft:** every external call wrapped in try/except with a sane fallback payload; a single dead source must not blank the whole UI.
- **Delayed data is fine** — label it as such in responses; do not attempt real-time streaming for the MVP.
- **Secrets** (FRED key if Phase 2, Gemini key) via environment variables only.

---

## 9. MVP vs. stretch (scope guardrail)

**MVP (build first):** GDELT news + tone → `/api/news`; yfinance/OpenBB OHLCV → `/api/market`; Gemini framing-contrast + divergence via code execution → `/api/perspective`; region registry → `/api/regions`. TradingView charts are frontend.

**Stretch (only after MVP is solid):** SEC filing ground-truth layer (OpenBB SEC provider), FRED macro overlay, personal-holdings exposure math, scenario simulator, TTS briefing.
