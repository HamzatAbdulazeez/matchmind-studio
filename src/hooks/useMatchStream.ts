"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchMeta, MatchState } from "@/types/match";
import type { CommentaryLine } from "@/types/ai";
import type { Language } from "@/lib/ai/options";

type Status = "idle" | "live" | "ended" | "error";

export function useMatchStream() {
  const [meta, setMeta] = useState<MatchMeta | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [commentary, setCommentary] = useState<CommentaryLine[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const sourceRef = useRef<EventSource | null>(null);

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const start = useCallback((speed = 60, language: Language = "English") => {
    close();
    setState(null);
    setCommentary([]);
    setStatus("live");
    const es = new EventSource(`/api/match/stream?speed=${speed}&lang=${encodeURIComponent(language)}`);
    sourceRef.current = es;

    es.addEventListener("meta", (e: MessageEvent) => setMeta(JSON.parse(e.data)));
    es.addEventListener("tick", (e: MessageEvent) => setState(JSON.parse(e.data).state));
    es.addEventListener("commentary", (e: MessageEvent) =>
      setCommentary((lines) => [JSON.parse(e.data) as CommentaryLine, ...lines].slice(0, 40)),
    );
    es.addEventListener("end", () => { close(); setStatus("ended"); });
    es.onerror = () => {
      if (sourceRef.current) { close(); setStatus("error"); }
    };
  }, [close]);

  const stop = useCallback(() => { close(); setStatus("ended"); }, [close]);

  useEffect(() => close, [close]);

  return { meta, state, commentary, status, start, stop };
}