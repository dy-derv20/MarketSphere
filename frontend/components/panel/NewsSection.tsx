"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Newspaper } from "lucide-react";
import type { Panel } from "@/types/api";
import type { NewsArticle } from "@/types/panel";
import { useNews } from "@/lib/useNews";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import NewsRow from "@/components/panel/NewsRow";
import ExpandedOverlay from "@/components/panel/ExpandedOverlay";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

const CARD_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

function NewsDetail({ article }: { article: NewsArticle }) {
  const bodyText = article.summary ?? article.body ?? null;

  return (
    <div className="flex flex-col">
      {article.imageUrl && (
        // Plain <img>, not next/image: articles come from many different
        // external domains (GDELT/Guardian/Alpha Vantage), and next/image
        // would need those pre-registered in next.config.ts's remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.imageUrl} alt="" className="h-56 w-full shrink-0 object-cover sm:h-72" />
      )}
      <div className={`flex flex-col gap-4 px-6 pb-8 sm:px-10 sm:pb-10 ${article.imageUrl ? "pt-6 sm:pt-8" : "pt-14 sm:pt-16"}`}>

        <div className="text-xs font-medium uppercase tracking-wide text-[#8a8779]">
          {article.source} · {formatRelativeTime(article.publishedAt)}
        </div>
        <h1 className="text-2xl font-semibold leading-snug tracking-tight text-[#141821] sm:text-3xl">
          {article.headline}
        </h1>
        {bodyText && (
          <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-[#3a3a34]">{bodyText}</p>
        )}
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#12b886] px-4 py-2 text-sm font-semibold text-[#050708] transition-opacity hover:opacity-90"
          >
            Read full article
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export default function NewsSection({ panels, label }: { panels: Panel[]; label: string }) {
  const newsState = useNews(panels);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const articles = useMemo(() => (newsState.status === "ready" ? newsState.articles : []), [newsState]);
  const activeIndex = useMemo(() => articles.findIndex((a) => a.id === activeId), [articles, activeId]);
  const active = activeIndex >= 0 ? articles[activeIndex] : null;

  const close = () => {
    setOpenedId(null);
    setActiveId(null);
  };
  const goPrev = () => activeIndex > 0 && setActiveId(articles[activeIndex - 1].id);
  const goNext = () => activeIndex >= 0 && activeIndex < articles.length - 1 && setActiveId(articles[activeIndex + 1].id);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-[#5ad1e0]" />
          <Newspaper className="h-4 w-4 text-[#5ad1e0]" strokeWidth={2.25} />
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">News</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-[#5b6472]">{label}</span>
      </div>

      {newsState.status === "loading" && <SkeletonRows count={5} />}

      {newsState.status === "error" && <ErrorState message="Couldn't load news. Check your connection and try again." />}

      {newsState.status === "ready" &&
        (articles.length === 0 ? (
          <EmptyState message="No fresh headlines right now — check back soon." />
        ) : (
          <div className="flex flex-col gap-2">
            {articles.map((article) =>
              article.id === openedId ? null : (
                <motion.div
                  key={article.id}
                  layoutId={`news-card-${article.id}`}
                  layout
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.99 }}
                  transition={CARD_SPRING}
                  onClick={() => {
                    setOpenedId(article.id);
                    setActiveId(article.id);
                  }}
                  className="cursor-pointer"
                >
                  <NewsRow article={article} />
                </motion.div>
              ),
            )}
          </div>
        ))}

      <AnimatePresence>
        {openedId && active && (
          <ExpandedOverlay
            layoutId={`news-card-${openedId}`}
            onClose={close}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={activeIndex > 0}
            hasNext={activeIndex >= 0 && activeIndex < articles.length - 1}
            ariaLabel={active.headline}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <NewsDetail article={active} />
              </motion.div>
            </AnimatePresence>
          </ExpandedOverlay>
        )}
      </AnimatePresence>
    </section>
  );
}
