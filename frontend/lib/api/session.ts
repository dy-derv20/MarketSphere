import { apiRequest } from "@/lib/api/http";
import type { SessionState } from "@/types/api";

export function createSession(): Promise<SessionState> {
  return apiRequest<SessionState>("/api/session", { method: "POST" });
}

export function getSession(sessionId: string): Promise<SessionState> {
  return apiRequest<SessionState>(`/api/session/${sessionId}`);
}
