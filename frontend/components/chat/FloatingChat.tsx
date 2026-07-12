"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Send, Sparkles, X } from "lucide-react";
import { sendChatMessage } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/http";
import type { AnswerStreamEvent, ChatMessage, PanelConfig } from "@/types/api";

interface DisplayMessage {
  id: string;
  role: "user" | "model";
  content: string;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return "The assistant is temporarily unavailable — try again in a moment.";
    if (err.status === 404) return "Session expired — refresh the page and try again.";
    if (err.status === null) return "Couldn't reach the assistant. Check your connection.";
  }
  return "Something went wrong sending that message.";
}

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30 };

interface FloatingChatProps {
  sessionId: string | null;
  initialMessages?: ChatMessage[];
  activeView: "scope" | "workspace";
  workspaceConfig: PanelConfig | null;
  currentScope: string;
  onWorkspaceBuild: (config: PanelConfig) => void;
}

export default function FloatingChat({
  sessionId,
  initialMessages = [],
  activeView,
  workspaceConfig,
  currentScope,
  onWorkspaceBuild,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // initialMessages arrives asynchronously once useAppSession's restore
  // fetch resolves (empty on first render, populated moments later if the
  // backend had saved history for this session_id) - seed the visible
  // thread from it so a reload doesn't silently drop the conversation.
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages.map((m) => ({ id: newId(), role: m.role, content: m.content })));
    }
  }, [initialMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending, error]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending || !sessionId) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);
    setIsSending(true);

    try {
      const result = await sendChatMessage({ sessionId, message: text, activeView, workspaceConfig, currentScope });

      if (result.kind === "stream") {
        const modelId = newId();
        setMessages((prev) => [...prev, { id: modelId, role: "model", content: "" }]);
        let streamError: AnswerStreamEvent | null = null;

        for await (const event of result.events) {
          if (event.type === "text") {
            setMessages((prev) =>
              prev.map((m) => (m.id === modelId ? { ...m, content: m.content + event.text } : m)),
            );
          } else if (event.type === "error") {
            streamError = event;
          }
          // "done" carries citations - not surfaced in the UI yet, ignored here.
        }

        if (streamError) {
          // Interrupted mid-stream: drop the partial bubble rather than leaving
          // a truncated, unlabeled reply, and show the real error instead.
          setMessages((prev) => prev.filter((m) => m.id !== modelId));
          setError(streamError.message);
        }
      } else {
        const { data } = result;
        if (data.action === "build") {
          // This is the part that actually renders the built config - without
          // this call, the panel content silently stays whatever it was
          // before, even though the backend genuinely built a new config.
          onWorkspaceBuild(data.config);
        }
        const content =
          data.action === "build"
            ? (data.notes ?? `Updated your workspace with ${data.config.panels.length} panel(s).`)
            : data.text;
        setMessages((prev) => [...prev, { id: newId(), role: "model", content }]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <div key="trigger-wrap" className="relative">
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full bg-[#12b886]/40 blur-md"
              animate={{ scale: [1, 1.22, 1], opacity: [0.35, 0.65, 0.35] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.button
              layoutId="chat-shell"
              layout
              transition={SPRING}
              onClick={() => setIsOpen(true)}
              aria-label="Open assistant"
              className="relative flex items-center justify-center rounded-full border border-[#12b886]/40 bg-[#0d1219] text-[#7fe0c4] shadow-[0_0_24px_rgba(18,184,134,0.25)] transition-colors hover:border-[#12b886]/70 hover:text-[#12b886]"
              style={{ height: 60, width: 60 }}
            >
              <Sparkles className="h-6 w-6" />
            </motion.button>
          </div>
        ) : (
          <motion.div
            key="panel"
            layoutId="chat-shell"
            layout
            transition={SPRING}
            style={{ width: 380, height: "min(600px, 80vh)", borderRadius: 28 }}
            className="flex flex-col overflow-hidden border border-white/10 bg-[#0d1219] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#12b886] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#12b886]" />
                </span>
                <span className="text-sm font-semibold text-zinc-100">Assistant</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
                className="rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-3">
                {messages.length === 0 && !isSending && (
                  <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500">
                    Ask about what&apos;s moving markets right now.
                  </p>
                )}

                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "self-end rounded-br-sm border border-[#12b886]/25 bg-[#12b886]/12 text-zinc-100"
                        : "self-start rounded-bl-sm border border-white/10 bg-white/[0.04] text-zinc-200"
                    }`}
                  >
                    {m.content}
                  </motion.div>
                ))}

                {isSending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex w-fit items-center gap-1.5 self-start rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-[#7fe0c4]"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 self-center rounded-xl border border-[#e2554f]/30 bg-[#e2554f]/10 px-3 py-2 text-xs text-[#e2554f]"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="shrink-0 border-t border-white/5 p-3">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] pl-4 pr-1.5 py-1.5 focus-within:border-[#12b886]/40">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={sessionId ? "Ask the assistant…" : "Connecting…"}
                  disabled={!sessionId || isSending}
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!sessionId || isSending || !input.trim()}
                  aria-label="Send message"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#12b886] text-[#050708] transition-opacity disabled:opacity-30"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
