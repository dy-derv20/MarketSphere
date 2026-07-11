export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  /** ISO 8601 timestamp — relative display ("2h ago") is computed at render time. */
  publishedAt: string;
}
