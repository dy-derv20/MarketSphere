"use client";

import { useEffect, useRef } from "react";

interface TradingViewMiniWidgetProps {
  symbol: string;
  label: string;
}

// Manually manages script injection/cleanup via a ref rather than rendering
// a <script> tag through JSX — guards against duplicate widgets mounting
// under React Strict Mode's dev-only double-invoke, and re-injects cleanly
// if `symbol` changes.
export default function TradingViewMiniWidget({ symbol, label }: TradingViewMiniWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      height: 120,
      locale: "en",
      dateRange: "1M",
      colorTheme: "light",
      isTransparent: true,
      autosize: true,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="overflow-hidden rounded-2xl bg-[#f4f2ea] px-3 pb-1 pt-2.5">
      <div className="truncate px-1 text-xs font-medium text-[#8a8779]">{label}</div>
      <div ref={containerRef} className="tradingview-widget-container" />
    </div>
  );
}
