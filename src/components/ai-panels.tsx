"use client";

import { useState } from "react";
import type { Explanation, Recap } from "@/types/ai";
import type { MatchMeta } from "@/types/match";
import { LANGUAGES, RECAP_STYLES, type Language, type RecapStyle } from "@/lib/ai/options";
import { Panel, primaryButton, selectClass } from "./ui";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`The request failed (${res.status}). Check the server console, then try again.`);
  return res.json();
}

export function ExplainButton({ momentId, minute }: { momentId: string; minute: number }) {
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const explain = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await postJSON<Explanation>("/api/ai/explain", { momentId, minute }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (data) {
    return (
      <div className="mt-2 rounded-md border-l-2 border-gold bg-night/60 p-3 text-sm">
        <p className="font-display text-base font-semibold">{data.headline}</p>
        <p className="mt-1 leading-relaxed text-chalk/90">{data.explanation}</p>
        <ul className="mt-2 space-y-0.5 text-xs text-mist">
          {data.evidence.map((ev) => <li key={ev}>{ev}</li>)}
        </ul>
        {data.source === "fallback" && (
          <p className="mt-2 text-xs text-gold">AI is offline, so this shows the raw evidence. Add your Azure OpenAI keys to get explanations.</p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={explain}
        disabled={loading}
        className="mt-2 text-xs font-semibold text-gold underline-offset-4 hover:underline disabled:opacity-50"
      >
        {loading ? "Explaining…" : "Explain why it mattered"}
      </button>
      {error && <p className="mt-1 text-xs text-tally">{error}</p>}
    </>
  );
}

type RecapResult = Recap & { language: Language; minute: number };

export function RecapPanel({ meta, minute }: { meta: MatchMeta; minute: number }) {
  const [style, setStyle] = useState<RecapStyle>("tv");
  const [language, setLanguage] = useState<Language>("English");
  const [focus, setFocus] = useState<"" | "home" | "away">("");
  const [recap, setRecap] = useState<RecapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const data = await postJSON<Recap>("/api/ai/recap", {
        style, language, focusTeam: focus || undefined, minute,
      });
      setRecap({ ...data, language, minute });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!recap) return;
    await navigator.clipboard.writeText(`${recap.title}\n\n${recap.body}`);
    setCopied(true);
  };

  return (
    <Panel title="Recap studio">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Recap format" className="flex flex-wrap overflow-hidden rounded-md border border-rail">
          {(Object.entries(RECAP_STYLES) as [RecapStyle, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStyle(value)}
              aria-pressed={style === value}
              className={`px-3 py-2 text-sm transition-colors ${
                style === value ? "bg-chalk font-semibold text-night" : "text-mist hover:bg-night/60 hover:text-chalk"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select aria-label="Recap language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={selectClass}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select aria-label="Audience" value={focus} onChange={(e) => setFocus(e.target.value as "" | "home" | "away")} className={selectClass}>
          <option value="">Neutral audience</option>
          <option value="home">{meta.home.name} fans</option>
          <option value="away">{meta.away.name} fans</option>
        </select>
        <button onClick={generate} disabled={loading} className={primaryButton}>
          {loading ? "Writing recap…" : `Write recap at ${minute}'`}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-tally">{error}</p>}

      {recap ? (
        <article dir={recap.language === "Arabic" ? "rtl" : "ltr"} className="mt-5 overflow-hidden rounded-md bg-paper text-ink">
          <div className="flex h-2">
            <div className="flex-1 bg-home" />
            <div className="flex-1 bg-away" />
          </div>
          <div className="p-5 md:p-8">
            <h3 className="font-display text-3xl font-bold leading-tight md:text-4xl">{recap.title}</h3>
            <p className="mt-4 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{recap.body}</p>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3 text-xs text-ink/60">
              <span>
                Written at {recap.minute}&apos; in {recap.language}
                {recap.source === "fallback" && ". AI is offline, so this is a template recap"}
              </span>
              <button onClick={copy} className="font-semibold text-ink underline-offset-4 hover:underline">
                {copied ? "Copied" : "Copy text"}
              </button>
            </div>
          </div>
        </article>
      ) : (
        <p className="mt-4 text-sm text-mist">
          Pick a format, language and audience, then write a recap of the match so far. It works at any minute, not just full-time.
        </p>
      )}
    </Panel>
  );
}