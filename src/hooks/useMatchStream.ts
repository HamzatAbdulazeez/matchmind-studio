"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchEvent, MatchMeta, MatchState, TeamSide, TeamStats } from "@/types/match";
import type { CommentaryLine } from "@/types/ai";
import type { Language } from "@/lib/ai/options";
import type { ViewerProfile } from "@/lib/personalize";
import type { OverlayCue } from "@/lib/overlay/cues";

type Status = "idle" | "live" | "ended" | "error";

export interface StatsSnapshot {
  minute: number;
  stats: Record<TeamSide, TeamStats>;
}

export interface StreamOptions {
  speed?: number;
  language?: Language;
  profile?: ViewerProfile;
  commentary?: boolean;
}

export function useMatchStream() {
  const [meta, setMeta] = useState<MatchMeta | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [commentary, setCommentary] = useState<CommentaryLine[]>([]);
  const [cues, setCues] = useState<OverlayCue[]>([]);
  const [history, setHistory] = useState<StatsSnapshot[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const start = useCallback((opts: StreamOptions = {}) => {
    const { speed = 60, language = "English", profile, commentary: withCommentary = true } = opts;
    close();
    setState(null);
    setCommentary([]);
    setCues([]);
    setHistory([]);
    setEvents([]);
    setStatus("live");

    const params = new URLSearchParams({ speed: String(speed), lang: language });
    if (!withCommentary) params.set("commentary", "off");
    if (profile) {
      params.set("mode", profile.mode);
      params.set("metric", profile.metric);
      if (profile.team) params.set("team", profile.team);
      if (profile.playerId) params.set("playerId", profile.playerId);
    }
    const es = new EventSource(`/api/match/stream?${params}`);
    sourceRef.current = es;

    es.addEventListener("meta", (e: MessageEvent) => setMeta(JSON.parse(e.data)));
    es.addEventListener("tick", (e: MessageEvent) => {
      const tick: { event: MatchEvent; state: MatchState } = JSON.parse(e.data);
      const next = tick.state;
      setState(next);
      setEvents((list) => [...list, tick.event]);
      setHistory((h) => {
        const snap = { minute: next.minute, stats: next.stats };
        return h.length && h[h.length - 1].minute === next.minute ? [...h.slice(0, -1), snap] : [...h, snap];
      });
    });
    es.addEventListener("commentary", (e: MessageEvent) =>
      setCommentary((lines) => [JSON.parse(e.data) as CommentaryLine, ...lines].slice(0, 40)),
    );
    es.addEventListener("cue", (e: MessageEvent) => setCues((c) => [...c, JSON.parse(e.data) as OverlayCue].slice(-60)));
    es.addEventListener("end", () => { close(); setStatus("ended"); });
    es.onerror = () => {
      if (sourceRef.current) { close(); setStatus("error"); }
    };
  }, [close]);

  const stop = useCallback(() => { close(); setStatus("ended"); }, [close]);

  useEffect(() => close, [close]);

  return { meta, state, events, commentary, cues, history, status, start, stop };
}