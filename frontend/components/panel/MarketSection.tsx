"use client";

import type { ContinentId } from "@/types/globe";
import { useRegions } from "@/lib/useRegions";
import { useMarket } from "@/lib/useMarket";
import { groupRegionsByContinent } from "@/lib/api/regionsByContinent";
import MarketChart from "@/components/panel/MarketChart";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

export default function MarketSection({ continentId }: { continentId: ContinentId }) {
  const regionsState = useRegions();
  const marketState = useMarket();

  const loading = regionsState.status === "loading" || marketState.status === "loading";
  const errored = regionsState.status === "error" || marketState.status === "error";

  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-[#5b6472]">Market</h2>

      {loading && <SkeletonRows count={3} />}

      {!loading && errored && (
        <ErrorState message="Couldn't load market data. Check your connection and try again." />
      )}

      {!loading &&
        !errored &&
        regionsState.status === "ready" &&
        marketState.status === "ready" &&
        (() => {
          const regions = groupRegionsByContinent(regionsState.regions)[continentId] ?? [];
          if (regions.length === 0) {
            // Real case, not hypothetical: Africa has no entries in the
            // backend's region registry yet — see CLAUDE.md's known blocker.
            return <EmptyState message="No tracked markets for this region yet." />;
          }
          return (
            <div className="flex flex-col gap-2">
              {regions.map((region) => {
                // /api/market has no per-symbol filtering — it always
                // returns all 10 registry series in one call, matched here
                // by yf_ticker (both derived from the same backend REGIONS
                // list, so this is a real key match, not a guess).
                const series = marketState.series.find((s) => s.symbol === region.yf_ticker);
                return <MarketChart key={region.yf_ticker} label={region.region} ohlcv={series?.ohlcv ?? []} />;
              })}
            </div>
          );
        })()}
    </section>
  );
}
