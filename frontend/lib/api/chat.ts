import { apiRequest } from "@/lib/api/http";
import type { ChatMessage } from "@/types/api";

export function sendChatMessage(sessionId: string, message: string): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/api/chat/${sessionId}`, { method: "POST", body: { message } });
}
