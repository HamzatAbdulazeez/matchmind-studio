import type { Match, TeamSide } from "@/types/match";
import { DEFAULT_PROFILE, METRICS, isMetric, isViewMode, type ViewerProfile } from "@/lib/personalize";
import type { Personalization } from "./prompts";

export function parseProfile(raw: Record<string, unknown>, match: Match): ViewerProfile {
  const team: TeamSide | undefined = raw.team === "home" || raw.team === "away" ? raw.team : undefined;
  const allPlayers = [...match.home.players, ...match.away.players];
  const playerId = typeof raw.playerId === "string" && allPlayers.some((p) => p.id === raw.playerId) ? raw.playerId : undefined;
  return {
    mode: isViewMode(raw.mode) ? raw.mode : DEFAULT_PROFILE.mode,
    team,
    playerId,
    metric: isMetric(raw.metric) ? raw.metric : DEFAULT_PROFILE.metric,
  };
}

export function toPersonalization(profile: ViewerProfile, match: Match): Personalization {
  const player = [...match.home.players, ...match.away.players].find((p) => p.id === profile.playerId);
  return {
    mode: profile.mode,
    teamName: profile.team ? match[profile.team].name : undefined,
    playerName: profile.mode === "player" ? player?.name : undefined,
    metricLabel: profile.mode === "metric" ? METRICS[profile.metric].label : undefined,
  };
}