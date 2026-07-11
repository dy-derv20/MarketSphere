// Mirrors backend/API.md response shapes exactly. Only the endpoints this
// session actually consumes (session, scope, regions, news, market) are
// typed here — chat/perspective are documented in API.md but intentionally
// out of scope for this integration pass (see CLAUDE.md Phase D).

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
