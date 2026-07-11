# Frontend Spec — Market Panel Chart

**Audience:** Frontend build agent
**Task:** Replace the current market panel (price readout + href out to TradingView) with a **real interactive chart rendered on our own site**, driven by our `/api/market` data.
**Companion to:** `BACKEND_ARCHITECTURE.md` (panel config, `/api/market`, `/api/news` shapes).

---

## 0. TL;DR / decision

Use **TradingView Lightweight Charts** (open-source library, ~35 KB) fed by our `/api/market` yfinance OHLCV. **Not** the embeddable widget.

**Why this and not the widget:** the embeddable TradingView widget renders *TradingView's own data feed* from a symbol string — it cannot ingest our data and, critically, **cannot draw our tone/divergence overlay line.** Our whole product is price-vs-narrative, so the chart must be *our* series with a second line on the same axis. Only Lightweight Charts does that.

The widget is documented in §6 as a **fallback for chart-only panels where no overlay is needed** (e.g., a default scope view). Do not use it for the main workspace market panel.

---

## 1. Install

```bash
npm i lightweight-charts
```

> **Version matters — check it:** `npm ls lightweight-charts`.
> - **v5** (current): series are created with `chart.addSeries(CandlestickSeries, opts)` — you must import the series type.
> - **v4**: series are created with `chart.addCandlestickSeries()` / `chart.addLineSeries()`.
> Use the form that matches the installed version. Both are shown below.

---

## 2. Data contract (from backend)

`GET /api/market?symbol=^GDAXI&range=1mo&interval=1d` →
```jsonc
{
  "symbol": "^GDAXI",
  "ohlcv": [
    { "date": "2026-06-01", "open": 18200.1, "high": 18355.0, "low": 18150.2, "close": 18310.4, "volume": 91234000 }
    // ... ascending by date
  ]
}
```

`GET /api/news?...` → includes `tone_timeline` for the overlay:
```jsonc
{
  "articles": [ ... ],
  "tone_timeline": [ { "date": "2026-06-01", "tone": -1.8 } ]   // avg GDELT/news tone per day
}
```

---

## 3. Core component (candlesticks)

```tsx
import { createChart, CandlestickSeries } from "lightweight-charts"; // v5 imports
import { useEffect, useRef } from "react";

type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };

export function MarketChart({ ohlcv }: { ohlcv: Bar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !ohlcv?.length) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#d1d4dc" },
      grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      timeScale: { timeVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
    });

    // --- v5 form ---
    const candles = chart.addSeries(CandlestickSeries);
    // --- v4 form (use INSTEAD if on v4): const candles = chart.addCandlestickSeries();

    const data = ohlcv
      .map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })) // time = 'YYYY-MM-DD'
      .sort((a, b) => (a.time < b.time ? -1 : 1)); // MUST be ascending

    candles.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove(); // cleanup on unmount / data change
  }, [ohlcv]);

  return <div ref={containerRef} style={{ width: "100%", height: 300 }} />;
}
```

**Line variant** (simpler, if you want a line instead of candles): use `LineSeries` (v5) / `chart.addLineSeries()` (v4) and map to `{ time: d.date, value: d.close }`.

---

## 4. Data-shape gotchas (these are what actually break it)

1. **`time` format:** daily data uses a `'YYYY-MM-DD'` string (what yfinance returns — use `d.date` directly). Intraday uses a **UNIX epoch in seconds** (not ms) — divide JS `Date.getTime()` by 1000. Don't mix formats in one series.
2. **Ascending + unique:** data must be sorted ascending with unique timestamps or the library throws. Sort defensively (shown above); de-dupe if the backend ever returns repeats.
3. **Numbers, not strings:** ensure OHLC are numbers, not stringified.
4. **Cleanup:** always `chart.remove()` in the effect cleanup, keyed on `[ohlcv]`, or you leak charts on re-render.
5. **Sizing:** `autoSize: true` needs a parent with a real height. Give the container an explicit height (or a flex parent that has one).

---

## 5. The tone / divergence overlay (the money feature — build this)

This is why we chose Lightweight Charts. Add a **second series on the same time axis** driven by `tone_timeline` from `/api/news`, so the user watches narrative sentiment move against price.

```tsx
// after creating `candles`:
import { LineSeries } from "lightweight-charts"; // v5

// v5: const tone = chart.addSeries(LineSeries, { priceScaleId: "left", color: "#f5a623", lineWidth: 2 });
// v4: const tone = chart.addLineSeries({ priceScaleId: "left", color: "#f5a623", lineWidth: 2 });

chart.priceScale("left").applyOptions({ visible: true, borderVisible: false });

tone.setData(
  toneTimeline
    .map(t => ({ time: t.date, value: t.tone }))
    .sort((a, b) => (a.time < b.time ? -1 : 1))
);
```

Notes:
- Put tone on a **separate price scale** (`priceScaleId: "left"`) — its range (~ -10..+10) is nothing like the price range, so it needs its own axis.
- Align by `date`. Tone is daily; price daily — same `'YYYY-MM-DD'` keys line up automatically.
- The `MarketChart` component should accept an optional `toneTimeline` prop and only add the overlay when present. Scope-view panels may pass none; workspace/analyze panels pass it.

Prop shape:
```tsx
export function MarketChart({ ohlcv, toneTimeline }: { ohlcv: Bar[]; toneTimeline?: { date: string; tone: number }[] }) { ... }
```

---

## 6. FALLBACK ONLY — TradingView widget (chart-only, no overlay)

Use **only** where no overlay/analysis is needed and you want a zero-plumbing live chart (e.g., a default scope preview). It renders TradingView's feed, not ours; you cannot add lines to it.

```tsx
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

<AdvancedRealTimeChart symbol="XETR:DAX" interval="D" theme="dark" autosize />
```
- `symbol` = the panel's `tv_symbol` from the region registry (confirm via TradingView symbol search).
- Do **not** wire yfinance to this — it ignores external data.

---

## 7. Wiring into the config-driven renderer

Per `BACKEND_ARCHITECTURE.md`, panels are rendered from config. For a `type: "market"` panel:

1. Read `panel.params` → `{ symbol, range, interval }`.
2. Fetch `GET /api/market?symbol=...&range=...&interval=...` → `ohlcv`.
3. If this panel should show the overlay (workspace/analyze context), also fetch the matching `tone_timeline` from `/api/news` for the panel's country/topic.
4. Render `<MarketChart ohlcv={ohlcv} toneTimeline={tone?} />`.
5. Loading + error states: show a spinner while fetching; on fetch failure render a panel-level error (one dead panel must not blank the workspace).

---

## 8. Checklist

- [ ] Confirm installed `lightweight-charts` version; use matching series API.
- [ ] `MarketChart` renders candles from `/api/market` ohlcv.
- [ ] Ascending-sort + unique-time guard in place.
- [ ] Container has explicit height; `chart.remove()` cleanup on `[ohlcv]`.
- [ ] Optional `toneTimeline` overlay on a separate left price scale.
- [ ] Market panel in the config renderer fetches data and mounts `MarketChart`.
- [ ] Loading + per-panel error states.
- [ ] (Optional) widget fallback wired only for chart-only scope previews.
