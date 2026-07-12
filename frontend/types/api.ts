// Mirrors backend/API.md (v2) response shapes exactly. Endpoints consumed:
// session, scope, regions, news, market, chat, layouts.

export type PanelType = "news" | "market";

export interface NewsPanelParams {
  country: string | null;
  continent: string | null;
  query: string;
  timespan: string;
  max: number;
}

export interface MarketPanelParams {
  symbol: string;
  range: string;
  interval: string;
}

export interface Panel {
  id: string;
  type: PanelType;
  title: string;
  rationale: string;
  // Discriminate on `type` to narrow this to NewsPanelParams | MarketPanelParams.
  params: NewsPanelParams | MarketPanelParams;
}

export interface PanelConfig {
  version: number;
  panels: Panel[];
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  created_at: string;
}

export interface SessionState {
  session_id: string;
  scopeConfig: PanelConfig;
  messages: ChatMessage[];
}

export interface ScopeConfigResponse {
  scopeConfig: PanelConfig;
}

export interface ContinentInfo {
  id: string;
  label: string;
}

export interface Region {
  region: string;
  country_fips: string | null;
  yf_ticker: string;
  tv_symbol: string;
}

export interface NewsArticleApi {
  source: "guardian" | "alpha_vantage" | "gdelt";
  title: string;
  url: string;
  domain: string | null;
  body: string | null;
  summary: string | null;
  image_url: string | null;
  language: string | null;
  country: string | null;
  continent: string | null;
  sentiment_score: number | null;
  published_at: string;
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

export interface MarketResponse {
  symbol: string;
  ohlcv: OhlcvBar[];
}

// --- POST /api/chat ---

export interface ChatRequestBody {
  session_id: string;
  message: string;
  active_view: "scope" | "workspace";
  workspace_config: PanelConfig | null;
  current_scope: string;
}

// `answer` intent responds with an SSE stream — each event is one of these,
// JSON-encoded after a `data: ` prefix. Not part of the JSON response union
// below; consumed via lib/api/chat.ts's streaming reader instead.
export type AnswerStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; citations: string[] }
  | { type: "error"; message: string };

export interface BuildChatResponse {
  action: "build";
  target: "workspace";
  config: PanelConfig;
  switch_view: true;
  notes: string | null;
}

export interface AnalyzeEvidence {
  articles_used: string[];
  tone_trend: number;
  price_change_pct: number;
}

export interface AnalyzeChatResponse {
  action: "analyze";
  text: string;
  evidence: AnalyzeEvidence | null;
}

// The plain-JSON (non-streaming) chat response union — `answer` is handled
// separately since it's a stream, not a single JSON body.
export type ChatJsonResponse = BuildChatResponse | AnalyzeChatResponse;

// --- /api/layouts ---

export interface LayoutCreateRequest {
  name: string;
  config: PanelConfig;
  session_id: string | null;
}

export interface Layout {
  id: string;
  session_id: string | null;
  name: string;
  config: PanelConfig;
  created_at: string;
  updated_at: string;
}
