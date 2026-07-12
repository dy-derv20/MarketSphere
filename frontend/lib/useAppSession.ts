"use client";

import { useEffect, useRef, useState } from "react";
import { createSession, getSession } from "@/lib/api/session";
import type { ChatMessage } from "@/types/api";

const STORAGE_KEY = "marketsphere_session_id";

export type SessionStatus = "loading" | "ready" | "error";

export function useAppSession(): { sessionId: string | null; status: SessionStatus; initialMessages: ChatMessage[] } {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return; // guards against Strict Mode's double-invoke in dev
    initRef.current = true;

    (async () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const session = await getSession(stored);
          setSessionId(session.session_id);
          setInitialMessages(session.messages);
          setStatus("ready");
          return;
        } catch {
          // Stored id is stale or unknown to the backend (e.g. a fresh DB) —
          // fall through and mint a new one rather than getting stuck.
        }
      }
      try {
        const session = await createSession();
        window.localStorage.setItem(STORAGE_KEY, session.session_id);
        setSessionId(session.session_id);
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        console.error("[useAppSession] could not create a session:", err);
      }
    })();
  }, []);

  return { sessionId, status, initialMessages };
}
