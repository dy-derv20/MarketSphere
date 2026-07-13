"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import type { OhlcvBar, Panel } from "@/types/api";
import { useMarket, type HydratedMarketPanel } from "@/lib/useMarket";
import MarketChart from "@/components/panel/MarketChart";
import ExpandedOverlay from "@/components/panel/ExpandedOverlay";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

const CARD_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

// Pure display computation on OHLCV the section already has in hand (last
// close vs. the prior bar) - not a new data source, just surfacing what the
// chart already has for the expanded card's header stat line.
function latestChange(ohlcv: OhlcvBar[]): { value: number; change: number; changePct: number } | null {
  if (ohlcv.length === 0) return null;
  const sorted = [...ohlcv].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = sorted[sorted.length - 1];
  const prior = sorted[sorted.length - 2] ?? last;
  const change = last.close - prior.close;
  const changePct = prior.close !== 0 ? (change / prior.close) * 100 : 0;
  return { value: last.close, change, changePct };
}

function MarketDetail({ panel, ohlcv }: HydratedMarketPanel) {
  const stats = latestChange(ohlcv);
  const isUp = (stats?.change ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-6 px-6 pb-6 pt-14 sm:px-10 sm:pb-10 sm:pt-16">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-[#8a8779]">Market</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#141821] sm:text-3xl">{panel.title}</h1>
        {stats && (
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums text-[#141821]">
              {stats.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className={`text-sm font-semibold tabular-nums ${isUp ? "text-[#12b886]" : "text-[#e2554f]"}`}>
              {isUp ? "+" : ""}
              {stats.change.toFixed(2)} ({isUp ? "+" : ""}
              {stats.changePct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>
      <MarketChart label={panel.title} ohlcv={ohlcv} heightClassName="h-[46vh] sm:h-[52vh]" hideLabel />
    </div>
  );
}

export default function MarketSection({ panels }: { panels: Panel[] }) {
  const marketState = useMarket(panels);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const series = useMemo(() => (marketState.status === "ready" ? marketState.series : []), [marketState]);
  const activeIndex = useMemo(() => series.findIndex((s) => s.panel.id === activeId), [series, activeId]);
  const active = activeIndex >= 0 ? series[activeIndex] : null;

  const close = () => {
    setOpenedId(null);
    setActiveId(null);
  };
  const goPrev = () => activeIndex > 0 && setActiveId(series[activeIndex - 1].panel.id);
  const goNext = () => activeIndex >= 0 && activeIndex < series.length - 1 && setActiveId(series[activeIndex + 1].panel.id);

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
        (series.length === 0 ? (
          // Real case, not hypothetical: continents with no curated market
          // index in the registry yet (e.g. Africa) get zero market panels
          // from the backend's scope config.
          <EmptyState message="No tracked markets for this region yet." />
        ) : (
          <div className="flex flex-col gap-2">
            {series.map(({ panel, ohlcv }) =>
              panel.id === openedId ? null : (
                <motion.div
                  key={panel.id}
                  layoutId={`market-card-${panel.id}`}
                  layout
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.99 }}
                  transition={CARD_SPRING}
                  onClick={() => {
                    setOpenedId(panel.id);
                    setActiveId(panel.id);
                  }}
                  className="cursor-pointer"
                >
                  <MarketChart label={panel.title} ohlcv={ohlcv} />
                </motion.div>
              ),
            )}
          </div>
        ))}

      <AnimatePresence>
        {openedId && active && (
          <ExpandedOverlay
            layoutId={`market-card-${openedId}`}
            onClose={close}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={activeIndex > 0}
            hasNext={activeIndex >= 0 && activeIndex < series.length - 1}
            ariaLabel={`${active.panel.title} market detail`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active.panel.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <MarketDetail panel={active.panel} ohlcv={active.ohlcv} />
              </motion.div>
            </AnimatePresence>
          </ExpandedOverlay>
        )}
      </AnimatePresence>
    </section>
  );
}
