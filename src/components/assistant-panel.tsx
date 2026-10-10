"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MatchMeta } from "@/types/match";
import { Panel, primaryButton } from "./ui";

interface Message {
  role: "user" | "assistant";
  content: string;
  trace?: string[];
  source?: "ai" | "fallback";
}

export function AssistantPanel({ meta, minute }: { meta: MatchMeta; minute: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const suggestions = [
    "What changed after half-time?",
    "Who has been the most dangerous player so far?",
    `Compare ${meta.home.shortName} and ${meta.away.shortName} over the last 15 minutes`,
    "Why did the momentum swing?",
  ];

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minute, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `The request failed (${res.status}).`);
      setMessages((m) => [...m, { role: "assistant", content: data.answer, trace: data.trace, source: data.source }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <Panel
      title="Studio assistant"
      action={<span className="text-xs text-mist">Uses data up to {minute}&apos;</span>}
      className="flex flex-col"
    >
      <div ref={listRef} className="max-h-[28rem] min-h-48 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div>
            <p className="text-sm leading-relaxed text-mist">
              Ask about the match the way a producer would. The assistant checks the match data with its tools before it answers,
              and shows what it checked.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-rail px-3 py-1.5 text-left text-xs text-chalk transition-colors hover:border-chalk"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-chalk px-3 py-2 text-sm text-night">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="max-w-[92%]">
              <p className={`whitespace-pre-line text-sm leading-relaxed ${m.source === "fallback" ? "text-gold" : ""}`}>{m.content}</p>
              {m.trace && m.trace.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-mist">
                  <span>Checked</span>
                  {m.trace.map((t) => (
                    <span key={t} className="rounded-sm border border-rail px-1.5 py-0.5 font-display tabular-nums">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ),
        )}

        {loading && <p className="text-sm text-mist">Checking the match data…</p>}
      </div>

      {error && <p className="mt-3 text-sm text-tally">{error}</p>}

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <label htmlFor="assistant-input" className="sr-only">Ask the studio assistant</label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`For example: how has ${meta.away.shortName} created chances?`}
          className="min-w-0 flex-1 rounded-md border border-rail bg-night px-3 py-2 text-sm text-chalk placeholder:text-mist/70"
        />
        <button type="submit" disabled={loading || !input.trim()} className={primaryButton}>
          Ask
        </button>
      </form>
    </Panel>
  );
}