"use client";

import type { Panel } from "@/types/api";
import { useMarket } from "@/lib/useMarket";
import MarketChart from "@/components/panel/MarketChart";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

export default function MarketSection({ panels }: { panels: Panel[] }) {
  const marketState = useMarket(panels);

  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-[#5b6472]">Market</h2>

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
