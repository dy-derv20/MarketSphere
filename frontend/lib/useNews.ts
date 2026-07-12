"use client";

import { useEffect, useState } from "react";
import { getNews } from "@/lib/api/news";
import { parseGdeltTimestamp } from "@/lib/parseGdeltTimestamp";
import type { NewsPanelParams, Panel } from "@/types/api";
import type { NewsArticle } from "@/types/panel";

export type NewsState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; articles: NewsArticle[] };

// Takes the news-type panels from the current scopeConfig (see
// useScopeConfig) - usually one continent-level panel plus one per country
// for a continent scope, or a single world panel - fetches each via its own
// params, and flattens into one list. `domain` is nullable now (Guardian/
// Alpha Vantage articles don't always have one); falls back to the
// ingestion `source` label so NewsRow never renders "undefined".
export function useNews(newsPanels: Panel[]): NewsState {
  const [state, setState] = useState<NewsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (newsPanels.length === 0) {
      setState({ status: "ready", articles: [] });
      return;
    }
    setState({ status: "loading" });

    Promise.allSettled(
      newsPanels.map((panel) => {
        const params = panel.params as NewsPanelParams;
        return getNews({ country: params.country, continent: params.continent, max: params.max });
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const failed = results.every((r) => r.status === "rejected");
        if (failed) {
          setState({ status: "error", error: (results[0] as PromiseRejectedResult).reason });
          return;
        }
        const articles: NewsArticle[] = results
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getNews>>> => r.status === "fulfilled")
          .flatMap((r) => r.value.articles)
          .map((a, i) => ({
            id: `${a.url}-${i}`,
            headline: a.title,
            source: a.domain ?? a.source,
            publishedAt: parseGdeltTimestamp(a.published_at),
          }));
        setState({ status: "ready", articles });
      });

    return () => {
      cancelled = true;
    };
  }, [newsPanels]);

  return state;
}
