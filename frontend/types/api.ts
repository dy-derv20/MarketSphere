// Mirrors backend/API.md response shapes exactly. Endpoints consumed so
// far: session, scope, regions, news, market (Phase D), chat (Phase E).
// /api/perspective is documented in API.md but intentionally not wired up
// yet — see CLAUDE.md.

export type ScopeLevel = "world" | "continent";

export interface Scope {
  level: ScopeLevel;
  id: string;
  label: string;
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  created_at: string;
}

export interface SessionState {
  session_id: string;
  current_scope: Scope | null;
  current_news_snapshot: NewsResponse | null;
  current_market_snapshot: MarketResponse | null;
  messages: ChatMessage[];
}

export interface Region {
  region: string;
  country_fips: string | null;
  yf_ticker: string;
  tv_symbol: string;
}

export interface NewsArticleApi {
  title: string;
  url: string;
  domain: string;
  published_at: string;
  language: string;
  source_country: string;
}

export interface NewsResponse {
  articles: NewsArticleApi[];
}

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSeries {
  symbol: string;
  label: string;
  ohlcv: OhlcvBar[];
}

export interface MarketResponse {
  series: MarketSeries[];
}
