# Backend Architecture & Orchestration Spec

**Project:** Multi-Perspective Market & News Globe (working name "Parallax")
**Audience:** Backend engineer + Claude Code build agent
**Companion to:** `API_INFRASTRUCTURE.md` (data sources, external endpoints, region registry). This doc defines the **application layer**: request routing, Gemini orchestration, the panel-config contract, the dual-context state model, and per-route handler behavior. Where this doc says "fetch news/markets," the *how* lives in the infra doc.

---

## 0. Core architectural principle (read first)

**This is a router + structured-output system, NOT an agent.** Every supported query is single-step: classify intent → run one deterministic handler → respond. Do **not** implement an autonomous tool-calling loop — it adds latency, nondeterminism, and failure surface for zero benefit here.

Two rules govern everything:
1. **Your code fetches data; the model does language and structure.** The LLM never decides which HTTP calls happen. It classifies, it emits config JSON, and it reasons over data *you* hand it. Fetching stays deterministic, cacheable, and testable.
2. **Two writers, two targets, never crossing.** Globe navigation writes the **Scope** context. Chat `build` queries write the **Workspace** context. Nothing else moves panels. (See §2.)

---

## 1. Request flow (high level)

```
                        ┌─────────────────────────────┐
  navigation event ───▶ │  GET /api/scope?region=XX    │──▶ regenerate scopeConfig
                        └─────────────────────────────┘

                        ┌─────────────────────────────┐
  chat message ───────▶ │  POST /api/chat              │
                        └──────────────┬──────────────┘
                                       │  (1) classify: flash + schema
                                       ▼
                        ┌──────────────────────────────┐
                        │ intent ∈ {answer,build,analyze}│
                        └───┬──────────┬──────────┬─────┘
                  answer ◀──┘   build ◀┘   analyze◀┘
                     │            │            │
           grounded  │   emit config (flash) │  resolve entities → fetch
           gen +     │   validate vs registry │  news+market (deterministic)
           stream    │   → workspace target   │  → reason (pro) over real data
                     ▼            ▼            ▼
                  {action:answer}  {action:build}  {action:analyze}
```

Frontend renders panels from a config by calling `/api/news` and `/api/market` **per panel** (declarative configs + separate data hydration = small chat responses, cacheable data, parallelizable).

---

## 2. State model — dual context (the key design)

There are **two panel contexts**, one renderer, one writing rule.

| Context | Owner | Lifetime | Written by | Persisted? |
|---|---|---|---|---|
| **`scopeConfig`** | The globe | Ephemeral — regenerated on every scope change | Navigation events only | No — always regenerable from location |
| **`workspaceConfig`** | The user | Persistent — survives scope changes | Chat `build` queries only | Yes — saved via `/api/layouts` |

Plus one flag: **`activeView ∈ {"scope", "workspace"}`** — which context the single renderer currently draws.

### Writing rules (memorize these — they eliminate a whole bug class)
- **Scope change** (globe click) → regenerate `scopeConfig` from the new region. Never touches `workspaceConfig`.
- **`build` query** → writes `workspaceConfig` (full replace or delta). Auto-set `activeView = "workspace"` so the user sees their result. Never touches `scopeConfig`.
- **`answer` / `analyze` queries** → do **not** move any panels. Chat responses only.
- **"Add X" / deltas** always apply to `workspaceConfig`. You cannot edit Scope (it isn't yours); an edit attempt while in Scope view = fork current `scopeConfig` into `workspaceConfig`, then apply.

### Statelessness recommendation
Keep `/api/chat` **stateless**: the client holds `workspaceConfig` + `activeView` + current scope, and sends them in each request. The backend needs no session store for chat. The only persistence is **saved layouts** (explicit user action). Optionally attach a `session_id` for scoping saved layouts to a user. This is the simplest robust design for a 12h build.

### Random-flow scenario (worked)
World view (`scopeConfig`=global) → click N. America (`scopeConfig` regenerates to NA; workspace untouched) → chat "JP news + KR markets" (`build` → writes `workspaceConfig`, switches `activeView`=workspace) → click World (`scopeConfig` regenerates to global; workspace sits intact behind the toggle). Nothing lost, globe stays meaningful, custom view one tap away.

---

## 3. Panel config schema (the contract)

The single JSON shape shared by Gemini output, the renderer, and saved layouts. **Whitelisted panel types only.**

```jsonc
{
  "version": 1,
  "panels": [
    {
      "id": "p_a1b2",                // stable id; frontend keys on this for clean reconciliation
      "type": "news",               // ENUM: "news" | "market"  (whitelist — nothing else)
      "title": "Japan — Energy",    // model-generated display label
      "rationale": "Requested Japanese energy coverage.", // one-line "why this panel exists"
      "params": {
        "country": "JA",            // GDELT FIPS code — MUST validate vs registry
        "query": "energy",
        "timespan": "24h",
        "max": 40
      }
    },
    {
      "id": "p_c3d4",
      "type": "market",
      "title": "Nikkei 225",
      "rationale": "Paired market for Japan.",
      "params": {
        "symbol": "^N225",          // yfinance ticker — MUST validate vs registry
        "range": "1mo",
        "interval": "1d"
      }
    }
  ]
}
```

**Rules:**
- `type` is a closed enum. If the model wants anything else, it's rejected/repaired.
- `params.country` and `params.symbol` MUST exist in the region registry (infra doc §5). Validate before returning.
- `id` is generated server-side on new panels; preserved across deltas so the frontend doesn't remount unchanged panels.
- `rationale` is required — it's cheap, and it turns a config into an explainable workspace (product signal).

---

## 4. Intent classifier (route 0)

One cheap `gemini-flash` call with enforced `response_schema`. Runs on every chat message.

```jsonc
// classifier response schema
{
  "intent": "answer" | "build" | "analyze",   // closed enum
  "confidence": 0.0,                            // number
  "build_op": "replace" | "add" | "remove" | null, // only for build
  "entities": {
    "countries": ["JA"],        // human names or codes; resolver normalizes
    "companies": ["Toyota"],    // for analyze / entity resolution
    "topics": ["energy"],
    "timespan": "24h"           // nullable
  },
  "restated": "Show Japanese energy news alongside Japanese markets."
}
```

Route table:

| Example query | intent | Handler |
|---|---|---|
| "Tell me about the current global economy" | `answer` | §5.1 |
| "Show me Japanese news and markets" | `build` | §5.2 |
| "US markets and Japanese news" | `build` (replace) | §5.2 |
| "Now add Korea" | `build` (add) | §5.2 (delta) |
| "How is the news affecting this company's value?" | `analyze` | §5.3 |

> **Latency option:** once stable, you may fuse classify + build into one call for `build`-heavy usage. Start split — it's cleaner to test and debug. Two Gemini calls max per message.

---

## 5. Per-route handler contracts

### 5.1 `answer` — general / grounded response
- **Input:** user message (+ optional current context for light awareness).
- **Action:** one grounded Gemini generation (Google Search grounding on for current-economy questions). **Stream** the response.
- **Panels:** untouched.
- **Returns:** `{ "action": "answer", "text": "...", "citations": [...] }`

### 5.2 `build` — compose / modify the Workspace
- **Input:** `entities`, `build_op`, **current `workspaceConfig`**, region registry (as model context).
- **Action:**
  1. `gemini-flash` call, `response_schema` = panel config (§3). For deltas, pass current config and instruct add/remove; model returns the **full resulting config** (simpler than patch math).
  2. **Validate** every `country`/`symbol` against the registry. Unknowns → repair step (§6) or drop with a note.
  3. Assign ids to new panels; preserve ids of unchanged ones.
- **Target:** `workspaceConfig`. Set `switch_view = true`.
- **Returns:** `{ "action": "build", "target": "workspace", "config": {...}, "switch_view": true, "notes": "Couldn't find an index for 'Atlantis'; skipped." }`

### 5.3 `analyze` — news-sentiment → market reasoning (the differentiator)
This is the query a terminal can't do. **Fetch first, reason second — never let the model fetch.**
- **Input:** `entities` (esp. `companies`).
- **Action:**
  1. **Resolve entity** → ticker → home index + country (§7). If unresolved, return a graceful clarification.
  2. **Deterministically fetch** (parallel): GDELT news + tone for the entity/country, and the price series for its ticker (window aligned to the news window).
  3. **Reason:** `gemini-pro` call, given the fetched articles + price summary, with `response_schema` for a structured verdict.
  4. **Correlation, not causation:** the prompt MUST force hedged language — news *coincides with* / *may relate to*, never *causes*. State the tone trend and the price move and let the user connect them.
- **Panels:** optionally attach a supporting panel, but default is chat-only.
- **Returns:**
```jsonc
{
  "action": "analyze",
  "text": "Coverage of <co> turned more negative over the past 3 days (avg tone -X), coinciding with a Y% move in <index>. Note: association, not established causation.",
  "evidence": { "articles_used": [ ...urls... ], "tone_trend": -1.8, "price_change_pct": -2.3 }
}
```

### 5.4 Navigation (not a chat route)
- `GET /api/scope?region=XX` → build `scopeConfig`: the region's default news panel(s) + its representative index market panel, from the registry. Deterministic, cacheable. Writes `scopeConfig` only.

---

## 6. Robustness to LLM output (biggest real risk)

Layer these in order:
1. **Schema enforcement** — every logic-feeding call uses `response_schema`. Never parse free text.
2. **Registry validation** — after any config emit, check each `country`/`symbol` against the registry *before* returning. The model *will* invent `^NIKKEI`; the validator catches it.
3. **Bounded repair** — on malformed JSON or validation failure, **one** retry that feeds the error back ("`^NIKKEI` isn't valid; choose from: ^N225…"). Then fall back gracefully. No loops.
4. **Graceful per-panel degradation** — a panel whose data fetch fails renders an error state; one dead source never blanks the workspace.
5. **Testability** — because handlers are deterministic, unit-test each with **mocked model outputs**: given this classifier result / this config, assert the right fetch + response. (You cannot test an agent's wandering; you can test this.)

---

## 7. Entity resolver (the unglamorous keystone)

Both `build` and `analyze` route through this. Build it first-class.

- **Contract:** `resolve(name) -> { ticker, index_symbol, country_fips, region } | None`
- **MVP implementation:** a curated static map of ~30–50 well-known companies → ticker + home index + country, plus the index registry from the infra doc. Deterministic, fast, demo-safe.
- **Fallback for unknowns:** either a `yfinance` symbol search, or a Gemini-assisted guess **validated against a lookup** before use. If still unresolved → graceful "I couldn't identify a ticker for X; did you mean…?"
- **Never** forward an unresolved/unvalidated symbol to a data call.

---

## 8. Performance

- **Two model tiers:** `flash` for classifier + build (fast, structured); `pro` for `analyze` reasoning only.
- **≤2 model calls per message** (classify + one action). `answer` can be fused to 1.
- **Parallel fetch:** multi-panel builds and the analyze fetch use `asyncio.gather`. Never serial.
- **Cache** GDELT + market pulls by params (infra doc). Panels repeat countries/symbols constantly.
- **Stream** the `answer` path so general chat feels instant.
- **Pre-warm** demo regions + the hero `analyze` entity on startup.

---

## 9. Backend service surface (updated)

Frontend consumes only these. External calls happen server-side (except TradingView, client-side).

| Method | Path | Purpose | Returns |
|---|---|---|---|
| `POST` | `/api/session` | Create session; return world-scope config | `{ session_id, scopeConfig }` |
| `POST` | `/api/chat` | The router entry (stateless; client sends state) | `{action, ...}` per §5 |
| `GET` | `/api/scope` | Regenerate scopeConfig for a region | `{ scopeConfig }` |
| `GET` | `/api/news` | GDELT ArtList + tone (per-panel hydration) | `{articles[], tone_timeline[]}` |
| `GET` | `/api/market` | OHLCV via yfinance (per-panel hydration) | `{symbol, ohlcv[]}` |
| `GET/POST` | `/api/layouts` | Save/load named **workspace** configs | config(s) |
| `GET` | `/api/health` | Liveness | `{status}` |

`/api/chat` request body:
```jsonc
{
  "session_id": "…",            // optional; for layout scoping
  "message": "add Korea",
  "active_view": "workspace",
  "workspace_config": { ... },  // client-held state, sent each turn
  "current_scope": "NA"
}
```

---

## 10. Suggested types (Pydantic)

```python
from enum import Enum
from pydantic import BaseModel
from typing import Optional, Literal

class PanelType(str, Enum):
    news = "news"; market = "market"

class NewsParams(BaseModel):
    country: str; query: str; timespan: str = "24h"; max: int = 40

class MarketParams(BaseModel):
    symbol: str; range: str = "1mo"; interval: str = "1d"

class Panel(BaseModel):
    id: str; type: PanelType; title: str; rationale: str
    params: dict  # validated per type against registry

class PanelConfig(BaseModel):
    version: int = 1; panels: list[Panel]

class Intent(str, Enum):
    answer = "answer"; build = "build"; analyze = "analyze"

class ClassifierResult(BaseModel):
    intent: Intent; confidence: float
    build_op: Optional[Literal["replace","add","remove"]] = None
    entities: dict; restated: str
```

---

## 11. Build order (checklist)

1. Region registry + **entity resolver** (§7) — everything routes through these.
2. `/api/news`, `/api/market` with caching (infra doc) — the data floor.
3. `/api/scope` — deterministic scope config from registry.
4. Panel-config schema + validator (§3, §6.2).
5. Intent classifier (§4).
6. Handlers: `build` → `answer` → `analyze` (in that order of difficulty).
7. Repair + graceful-degradation wrappers (§6).
8. `/api/layouts` persistence (JSON or SQLite).
9. Pre-warm + stream polish.

---

## 12. Scope guardrail (MVP vs stretch)

**MVP:** dual-context state, classifier, all three handlers, entity resolver, config validation + repair, scope regeneration, layout save/load.

**Stretch (only after MVP is solid):** analyze auto-attaching supporting panels; SEC/FRED ground-truth in analyze; fork-scope-into-workspace UX; drag/resize layouts (`react-grid-layout`); multi-user layout scoping.
