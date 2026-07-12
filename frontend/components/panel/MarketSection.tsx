"use client";

import { TrendingUp } from "lucide-react";
import type { Panel } from "@/types/api";
import { useMarket } from "@/lib/useMarket";
import MarketChart from "@/components/panel/MarketChart";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

export default function MarketSection({ panels }: { panels: Panel[] }) {
  const marketState = useMarket(panels);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="h-4 w-1 rounded-full bg-[#12b886]" />
        <TrendingUp className="h-4 w-4 text-[#12b886]" strokeWidth={2.25} />
        <h2 className="text-base font-semibold tracking-tight text-zinc-50">Market</h2>
      </div>

      {marketState.status === "loading" && <SkeletonRows count={3} />}

      {marketState.status === "error" && (
        <ErrorState message="Couldn't load market data. Check your connection and try again." />
      )}

      {marketState.status === "ready" &&
        (marketState.series.length === 0 ? (
          // Real case, not hypothetical: continents with no curated market
          // index in the registry yet (e.g. Africa) get zero market panels
          // from the backend's scope config.
          <EmptyState message="No tracked markets for this region yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {marketState.series.map(({ panel, ohlcv }) => (
              <MarketChart key={panel.id} label={panel.title} ohlcv={ohlcv} />
            ))}
          </div>
        ))}
    </section>
  );
}
