export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  /** ISO 8601 timestamp — relative display ("2h ago") is computed at render time. */
  publishedAt: string;
  /** Passed through from the API response for the expanded reading view's "open original article" link. */
  url?: string;
  /** Passed through from the API response; not every article has one. */
  imageUrl?: string | null;
  /** Passed through from the API response for the expanded reading view's body preview. */
  summary?: string | null;
  body?: string | null;
}
