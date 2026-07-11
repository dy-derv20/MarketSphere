"use client";

import { useEffect, useState } from "react";
import { getNews } from "@/lib/api/news";
import { parseGdeltTimestamp } from "@/lib/parseGdeltTimestamp";
import type { NewsArticle } from "@/types/panel";

export type NewsState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; articles: NewsArticle[] };

// Adapts the raw API shape (types/api.ts NewsArticleApi) to the app-level
// NewsArticle shape NewsRow already renders, so NewsRow itself needed zero
// changes for this swap — same principle as MarketRow being replaced
// wholesale but NewsRow being reusable as-is.
export function useNews(): NewsState {
  const [state, setState] = useState<NewsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getNews()
      .then((res) => {
        if (cancelled) return;
        const articles: NewsArticle[] = res.articles.map((a, i) => ({
          id: `${a.url}-${i}`,
          headline: a.title,
          source: a.domain,
          publishedAt: parseGdeltTimestamp(a.published_at),
        }));
        setState({ status: "ready", articles });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
