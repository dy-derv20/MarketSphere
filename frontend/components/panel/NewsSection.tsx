"use client";

import { Newspaper } from "lucide-react";
import type { Panel } from "@/types/api";
import { useNews } from "@/lib/useNews";
import NewsRow from "@/components/panel/NewsRow";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/panel/SectionState";

export default function NewsSection({ panels, label }: { panels: Panel[]; label: string }) {
  const newsState = useNews(panels);

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
