"use client";

import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type CandlestickData, type Time } from "lightweight-charts";
import type { OhlcvBar } from "@/types/api";

interface MarketChartProps {
  label: string;
  ohlcv: OhlcvBar[];
}

// Own chart rendered from real /api/market OHLCV via TradingView's
// open-source Lightweight Charts library, replacing the embeddable
// TradingView widget (see FRONTEND_MARKET_PANEL.md). Cards stay on the
// same cream/rounded language as the rest of the panel; colors are tuned
// for a light card rather than the library's dark-theme defaults.
export default function MarketChart({ label, ohlcv }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !ohlcv.length) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#8a8779", attributionLogo: false },
      grid: { vertLines: { color: "rgba(0,0,0,0.04)" }, horzLines: { color: "rgba(0,0,0,0.04)" } },
      timeScale: { timeVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: false },
      crosshair: { vertLine: { labelBackgroundColor: "#12b886" }, horzLine: { labelBackgroundColor: "#12b886" } },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#12b886",
      downColor: "#e2554f",
      borderVisible: false,
      wickUpColor: "#12b886",
      wickDownColor: "#e2554f",
    });

    // De-dupe + ascending sort — the library throws on unordered or
    // repeated timestamps, and the backend's yfinance passthrough hasn't
    // been observed to violate this, but it isn't guaranteed either.
    const seen = new Set<string>();
    const data: CandlestickData<Time>[] = ohlcv
      .filter((bar) => (seen.has(bar.date) ? false : (seen.add(bar.date), true)))
      .map((bar) => ({ time: bar.date as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close }))
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

    candles.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [ohlcv]);

  return (
    <div className="overflow-hidden rounded-2xl bg-[#f4f2ea] px-3 pb-1 pt-2.5">
      <div className="truncate px-1 text-xs font-medium text-[#8a8779]">{label}</div>
      {ohlcv.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center px-1 text-[11px] text-[#8a8779]/70">
          Chart data unavailable
        </div>
      ) : (
        <div ref={containerRef} className="h-[120px] w-full" />
      )}
    </div>
  );
}
