"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { buttonVariants } from "./ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How has my training been this month?",
  "Am I eating enough protein for my training volume?",
  "What's my weakest lift and what should I do about it?",
  "What is my portfolio actually made of?",
];

/**
 * Chat with the coach. Each turn replays the whole stored conversation
 * server-side, so context survives a page reload.
 */
export function CoachChat({ enabled }: { enabled: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    fetch("/api/coach")
      .then((r) => r.json())
      .then((d: { conversationId: number | null; messages: Msg[] }) => {
        setConversationId(d.conversationId);
        setMessages(d.messages ?? []);
      })
      .catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);

      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <CoachDisabled />;

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[30rem] flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-10">
            <h2 className="text-center text-sm text-fg-subtle">
              I can see your training, food, bodyweight and portfolio. Ask me
              anything about them.
            </h2>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="rounded-md border border-line bg-raised px-3.5 py-3 text-left text-sm leading-snug text-fg-muted transition-colors duration-150 hover:border-line-strong hover:bg-overlay hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-lg rounded-br-sm bg-raised px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-fg"
                  : "max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap text-fg-muted"
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-fg-subtle">
            <Sparkles
              size={14}
              className="text-[var(--color-coach)]"
              style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }}
              aria-hidden="true"
            />
            Reading your data…
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-sm leading-relaxed text-[var(--color-neg)]"
          >
            <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-line bg-raised/40 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your training, food or portfolio…"
          disabled={busy}
          aria-label="Message the coach"
          className="flex-1 bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-fg-faint disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send message"
          className={`${buttonVariants.primary} size-8 rounded-md p-0`}
        >
          <ArrowUp size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function CoachDisabled() {
  return (
    <div className="rounded-lg border border-line bg-surface p-8">
      <Sparkles size={20} className="text-[var(--color-coach)]" aria-hidden="true" />
      <h2 className="mt-4 text-md font-medium text-fg">The coach needs an API key</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-subtle">
        It reads your training, nutrition and portfolio data and answers from the
        actual numbers. It runs on your own Anthropic credits, and it can only
        read — it cannot change your data or reach any connected account.
      </p>
      <p className="mt-4 max-w-prose text-sm leading-relaxed text-fg-subtle">
        Add{" "}
        <code className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-xs text-fg-muted">
          ANTHROPIC_API_KEY
        </code>{" "}
        to{" "}
        <code className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-xs text-fg-muted">
          .env.local
        </code>{" "}
        and restart the dev server. Everything else in the dashboard works
        without it.
      </p>
      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noreferrer"
        className={`${buttonVariants.secondary} mt-6`}
      >
        Get an API key
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
