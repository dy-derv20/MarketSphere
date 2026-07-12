"use client";

import type { Panel } from "@/types/api";
import { useNews } from "@/lib/useNews";
import NewsRow from "@/components/panel/NewsRow";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

export default function NewsSection({ panels, label }: { panels: Panel[]; label: string }) {
  const newsState = useNews(panels);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#5b6472]">News</h2>
        <span className="text-[10px] text-[#5b6472]/70">{label}</span>
      </div>

      {newsState.status === "loading" && <SkeletonRows count={5} />}

      {newsState.status === "error" && <ErrorState message="Couldn't load news. Check your connection and try again." />}

      {newsState.status === "ready" &&
        (newsState.articles.length === 0 ? (
          <EmptyState message="No fresh headlines right now — check back soon." />
        ) : (
          <div className="flex flex-col gap-2">
            {newsState.articles.map((article) => (
              <NewsRow key={article.id} article={article} />
            ))}
          </div>
        ))}
    </section>
  );
}
