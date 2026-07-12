import { ApiError } from "@/lib/api/http";
import type { AnswerStreamEvent, ChatJsonResponse, ChatRequestBody, PanelConfig } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ChatResult =
  | { kind: "stream"; events: AsyncGenerator<AnswerStreamEvent> }
  | { kind: "json"; data: ChatJsonResponse };

export interface SendChatMessageArgs {
  sessionId: string;
  message: string;
  activeView?: "scope" | "workspace";
  workspaceConfig?: PanelConfig | null;
  currentScope?: string;
}

// POST /api/chat's response shape depends on the backend's classified
// intent, decided *after* the request is sent - so unlike every other
// endpoint, this can't be typed generically up front. `answer` intent comes
// back as an SSE stream (text/event-stream); `build`/`analyze` come back as
// a single JSON body. Branch on Content-Type to tell them apart.
export async function sendChatMessage(args: SendChatMessageArgs): Promise<ChatResult> {
  const body: ChatRequestBody = {
    session_id: args.sessionId,
    message: args.message,
    active_view: args.activeView ?? "scope",
    workspace_config: args.workspaceConfig ?? null,
    current_scope: args.currentScope ?? "world",
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Network error reaching /api/chat", null);
  }

  if (!response.ok) {
    throw new ApiError(`POST /api/chat failed with ${response.status}`, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return { kind: "stream", events: parseSseStream(response) };
  }

  try {
    const data = (await response.json()) as ChatJsonResponse;
    return { kind: "json", data };
  } catch {
    throw new ApiError("/api/chat returned an unexpected (non-JSON) response", response.status);
  }
}

// Backend emits one `data: {json}\n\n` block per event (see
// backend/app/api/routes/chat.py's event_generator). Buffers partial reads
// across chunk boundaries and splits on the blank-line delimiter.
async function* parseSseStream(response: Response): AsyncGenerator<AnswerStreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
      if (dataLine) {
        try {
          yield JSON.parse(dataLine.slice(5).trim()) as AnswerStreamEvent;
        } catch {
          // Malformed event - skip it rather than killing the whole stream.
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
