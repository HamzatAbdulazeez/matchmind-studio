// Shared by client and server — viewer profiles and the metrics a fan can follow.
import type { MatchState, TeamSide, TeamStats } from "@/types/match";

export const VIEW_MODES = {
  casual: { label: "Casual fan", blurb: "The story in plain words: who's on top, what just happened, what to watch." },
  analyst: { label: "Analyst", blurb: "Every number: control vs chaos, pressing phases, pass quality, player tracking." },
  player: { label: "Player focus", blurb: "Follow one player all match: every touch, sprint and shot." },
  metric: { label: "Metric focus", blurb: "Track the one number you care about, minute by minute." },
} as const;

export type ViewMode = keyof typeof VIEW_MODES;

export const METRICS = {
  xG: { label: "Expected goals (xG)", unit: "", explain: "How many goals each team's chances were worth. Higher means better chances." },
  possession: { label: "Possession", unit: "%", explain: "Share of the passes each team has played." },
  pressures: { label: "Pressing", unit: "", explain: "How often each team closed down the player on the ball." },
  passAccuracy: { label: "Pass accuracy", unit: "%", explain: "Share of passes that reached a teammate." },
  hardPassesCompleted: { label: "Hard passes completed", unit: "", explain: "Completed passes rated 0.6+ for difficulty: long, under pressure or into the final third." },
  distanceKm: { label: "Distance covered", unit: " km", explain: "Total distance run by each team's players." },
  sprints: { label: "Sprints", unit: "", explain: "Runs faster than 25 km/h." },
} as const satisfies Partial<Record<keyof TeamStats, { label: string; unit: string; explain: string }>>;

export type MetricKey = keyof typeof METRICS;

export interface ViewerProfile {
  mode: ViewMode;
  team?: TeamSide; 
  playerId?: string; 
  metric: MetricKey;
}

export const DEFAULT_PROFILE: ViewerProfile = { mode: "analyst", metric: "xG" };

export function isViewMode(v: unknown): v is ViewMode {
  return typeof v === "string" && v in VIEW_MODES;
}

export function isMetric(v: unknown): v is MetricKey {
  return typeof v === "string" && v in METRICS;
}

/** Describes the control index in words. */
export function controlLabel(control: number): string {
  if (control >= 65) return "calm and controlled";
  if (control >= 45) return "open and end-to-end";
  return "chaotic and broken up";
}

/** Who is on top, in plain words, from the momentum index. */
export function momentumWords(state: MatchState, names: Record<TeamSide, string>): string {
  const m = state.momentum;
  if (Math.abs(m) < 20) return "Neither side is on top right now.";
  const side: TeamSide = m > 0 ? "home" : "away";
  return Math.abs(m) >= 60 ? `${names[side]} are well on top.` : `${names[side]} have the edge.`;
}