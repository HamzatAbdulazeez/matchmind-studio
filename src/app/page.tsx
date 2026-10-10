"use client";

import { useState } from "react";
import { useMatchStream } from "@/hooks/useMatchStream";
import { EventFeed, KeyMoments, MatchTimeline, Scorebug, StatsPanel } from "@/components/dashboard";
import { RecapPanel } from "@/components/ai-panels";
import { CommentaryPanel } from "@/components/commentary-panel";
import { PitchView, ShotMapPanel } from "@/components/pitch";
import { AssistantPanel } from "@/components/assistant-panel";
import { ExportPanel } from "@/components/export-panel";
import { Logo, selectClass } from "@/components/ui";
import { LANGUAGES, type Language } from "@/lib/ai/options";

const SPEEDS = [
  { label: "30× speed (3 min)", value: 30 },
  { label: "60× speed (90 sec)", value: 60 },
  { label: "120× speed", value: 120 },
  { label: "600× speed (quick demo)", value: 600 },
];

function GoLiveButton({ onClick, label, large = false }: { onClick: () => void; label: string; large?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md bg-tally font-semibold text-white transition-colors hover:bg-[#ff5240] ${
        large ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-white" />
      {label}
    </button>
  );
}

export default function Home() {
  const { meta, state, commentary, status, start, stop } = useMatchStream();
  const [speed, setSpeed] = useState(30);
  const [language, setLanguage] = useState<Language>("English");
  const live = status === "live";
  const goLive = () => start(speed, language);

  return (
    <main className="min-h-screen">
      <header className="border-b border-rail bg-night/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="font-display text-2xl font-bold leading-none tracking-wide">Hamzat MatchMind Studio</p>
              <p className="mt-0.5 text-xs text-mist">Explainable match intelligence</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Replay speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={live} className={selectClass}>
              {SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select aria-label="Commentary language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} disabled={live} className={selectClass}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l} commentary</option>)}
            </select>
            {live ? (
              <button onClick={stop} className="rounded-md border border-rail px-4 py-2 text-sm font-semibold hover:bg-deck">
                End broadcast
              </button>
            ) : (
              <GoLiveButton onClick={goLive} label={status === "idle" ? "Go live" : "Replay match"} />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 md:px-8 md:py-6">
        {status === "error" && (
          <p role="alert" className="rounded-md border border-tally/60 bg-tally/10 px-4 py-3 text-sm">
            The live stream disconnected. Check that the dev server is still running, then press Replay match.
          </p>
        )}

        {meta && state ? (
          <>
            <Scorebug meta={meta} state={state} live={live} />
            <MatchTimeline meta={meta} state={state} />

            <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
              <ShotMapPanel meta={meta} state={state} />
              <CommentaryPanel lines={commentary} live={live} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <StatsPanel meta={meta} state={state} />
              <KeyMoments moments={state.keyMoments} minute={state.minute} />
              <EventFeed meta={meta} events={state.recentEvents} />
            </div>

            <RecapPanel meta={meta} minute={state.minute} />

            <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
              <AssistantPanel meta={meta} minute={state.minute} />
              <ExportPanel />
            </div>
          </>
        ) : (
          <section className="grid items-center gap-8 py-6 lg:grid-cols-[1.3fr_1fr] lg:py-12">
            <div className="rounded-lg border border-rail bg-deck p-3">
              <PitchView shots={[]} />
            </div>
            <div>
              <h1 className="font-display text-5xl font-bold leading-[0.95] md:text-6xl">
                Every match, explained as it happens.
              </h1>
              <p className="mt-4 max-w-md leading-relaxed text-mist">
                Replay a match live with AI commentary, a shot map, momentum tracking, and recaps in nine languages.
                Every key moment comes with the data behind it.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <GoLiveButton onClick={goLive} label="Go live" large />
                <p className="text-sm text-mist">
                  {SPEEDS.find((s) => s.value === speed)?.label}, {language} commentary
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}