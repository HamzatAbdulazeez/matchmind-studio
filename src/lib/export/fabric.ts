import type { Match, TeamSide } from "@/types/match";
import { computeState } from "@/lib/engine/analysis";

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;

export const FABRIC_TABLES = ["events", "players", "team_stats", "momentum", "key_moments"] as const;
export type FabricTable = (typeof FABRIC_TABLES)[number];

export const TABLE_DESCRIPTIONS: Record<FabricTable, string> = {
  events: "Every event with minute, team, player, pitch position and xG",
  players: "Squads with positions and starters",
  team_stats: "Final stats per team",
  momentum: "Momentum index for every minute",
  key_moments: "Goals, big chances, red cards and momentum swings with evidence",
};

export function isFabricTable(value: string): value is FabricTable {
  return (FABRIC_TABLES as readonly string[]).includes(value);
}

function toCSV(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: Cell) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n") + "\n";
}

/** Builds Lakehouse-ready CSV tables for Microsoft Fabric. */
export function buildFabricTables(match: Match): Record<FabricTable, string> {
  const sides: TeamSide[] = ["home", "away"];
  const players = new Map(
    sides.flatMap((side) => match[side].players.map((p) => [p.id, { ...p, side }] as const)),
  );
  const state = computeState(match, match.events);

  const events: Row[] = match.events.map((e) => ({
    match_id: match.id,
    event_id: e.id,
    minute: e.minute,
    second: e.second,
    half: e.minute <= 45 ? 1 : 2,
    event_type: e.type,
    team_side: e.team,
    team_name: match[e.team].name,
    player_id: e.playerId ?? null,
    player_name: e.playerId ? players.get(e.playerId)?.name : null,
    secondary_player_name: e.secondaryPlayerId ? players.get(e.secondaryPlayerId)?.name : null,
    x: e.x ?? null,
    y: e.y ?? null,
    xg: e.xG ?? null,
    outcome: e.outcome ?? null,
  }));

  const playerRows: Row[] = [...players.values()].map((p) => ({
    match_id: match.id,
    player_id: p.id,
    team_side: p.side,
    team_name: match[p.side].name,
    player_name: p.name,
    shirt_number: p.number,
    position: p.position,
    starter: p.number <= 11,
  }));

  const teamStats: Row[] = sides.map((side) => ({
    match_id: match.id,
    team_side: side,
    team_name: match[side].name,
    goals: state.score[side],
    ...state.stats[side],
  }));

  const momentum: Row[] = state.momentumSeries.map((value, i) => ({
    match_id: match.id,
    minute: i + 1,
    momentum_index: value,
    leading_side: value > 0 ? "home" : value < 0 ? "away" : "level",
  }));

  const keyMoments: Row[] = state.keyMoments.map((k) => ({
    match_id: match.id,
    moment_id: k.id,
    minute: k.minute,
    kind: k.kind,
    team_side: k.team,
    team_name: match[k.team].name,
    title: k.title,
    importance: k.importance,
    evidence: k.evidence.join(" | "),
  }));

  return {
    events: toCSV(events),
    players: toCSV(playerRows),
    team_stats: toCSV(teamStats),
    momentum: toCSV(momentum),
    key_moments: toCSV(keyMoments),
  };
}