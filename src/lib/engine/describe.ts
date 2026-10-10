import type { MatchEvent, Team, TeamSide } from "@/types/match";

export function describeEvent(e: MatchEvent, teams: Record<TeamSide, Team>): string {
  const team = teams[e.team];
  const all = [...teams.home.players, ...teams.away.players];
  const name = (id?: string) => all.find((p) => p.id === id)?.name ?? "Unknown player";
  const p = name(e.playerId);

  switch (e.type) {
    case "kickoff": return `Kick-off: ${team.name} get us going`;
    case "pass": return e.outcome === "success" ? `${p} completes a ${e.distance ?? ""} m pass` : `${p} gives the ball away`;
    case "tackle": return `${p} wins a tackle`;
    case "interception": return `${p} intercepts`;
    case "possession_change": return `${team.name} win the ball back`;
    case "pressure": return `${p} presses ${name(e.secondaryPlayerId)}`;
    case "sprint": return `${p} hits ${e.speed} km/h`;
    case "shot": return `${p} shoots wide (xG ${e.xG}, ${e.speed} km/h)`;
    case "shot_on_target": return `${p} tests the keeper (xG ${e.xG}, ${e.speed} km/h)`;
    case "goal": return `GOAL! ${p} scores for ${team.name}${e.secondaryPlayerId ? `, assisted by ${name(e.secondaryPlayerId)}` : ""}`;
    case "save": return `${p} makes the save`;
    case "foul": return `Foul by ${p}${e.secondaryPlayerId ? ` on ${name(e.secondaryPlayerId)}` : ""}`;
    case "yellow_card": return `Yellow card for ${p}`;
    case "red_card": return `RED CARD: ${p} is sent off`;
    case "corner": return `Corner to ${team.name}`;
    case "offside": return `${p} flagged offside`;
    case "substitution": return `${team.shortName} change: ${p} on for ${name(e.secondaryPlayerId)}`;
    case "half_time": return "Half-time";
    case "full_time": return "Full-time";
  }
}