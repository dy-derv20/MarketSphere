"use client";

import type { ContinentId } from "@/types/globe";
import { useRegions } from "@/lib/useRegions";
import { groupRegionsByContinent } from "@/lib/api/regionsByContinent";
import TradingViewMiniWidget from "@/components/panel/TradingViewMiniWidget";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

export default function MarketSection({ continentId }: { continentId: ContinentId }) {
  const regionsState = useRegions();

  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-[#5b6472]">Market</h2>

      {regionsState.status === "loading" && <SkeletonRows count={3} />}

      {regionsState.status === "error" && <ErrorState message="Couldn't load market data. Check your connection and try again." />}

      {regionsState.status === "ready" &&
        (() => {
          const regions = groupRegionsByContinent(regionsState.regions)[continentId] ?? [];
          if (regions.length === 0) {
            // Real case, not hypothetical: Africa has no entries in the
            // backend's region registry yet — see CLAUDE.md's known blocker.
            return <EmptyState message="No tracked markets for this region yet." />;
          }
          return (
            <div className="flex flex-col gap-2">
              {regions.map((region) => (
                <TradingViewMiniWidget key={region.tv_symbol} symbol={region.tv_symbol} label={region.region} />
              ))}
            </div>
          );
        })()}
    </section>
  );
}
