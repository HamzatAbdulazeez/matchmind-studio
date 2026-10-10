import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { EventType, Match, MatchEvent, TeamSide } from "@/types/match";
import { computeState } from "@/lib/engine/analysis";
import { describeEvent } from "@/lib/engine/describe";

export interface ToolContext {
  match: Match;
  played: MatchEvent[]; 
}

export interface ToolOutput {
  result: unknown;
  label: string; 
}

const NON_PASS_TYPES: EventType[] = [
  "kickoff", "tackle", "interception", "shot", "shot_on_target", "goal", "save",
  "foul", "yellow_card", "red_card", "corner", "offside", "substitution", "half_time", "full_time",
];

const minuteRange = {
  from: { type: "integer", minimum: 0, maximum: 95, description: "First minute, inclusive" },
  to: { type: "integer", minimum: 0, maximum: 95, description: "Last minute, inclusive" },
};

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_match_overview",
      description: "Score, minute, period, full-match team stats and all key moments so far.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stats_between",
      description: "Team stats (possession, xG, shots, passes, fouls, cards) for a minute window, e.g. 60 to 75.",
      parameters: { type: "object", properties: minuteRange, required: ["from", "to"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_momentum",
      description: "Momentum index (-100 to +100, positive = home team on top) for a minute window, with averages and 5-minute snapshots.",
      parameters: { type: "object", properties: minuteRange, required: ["from", "to"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "find_events",
      description: "List match events (passes excluded) filtered by type, team, player name or minutes. Returns at most 25 events.",
      parameters: {
        type: "object",
        properties: {
          types: { type: "array", items: { type: "string", enum: NON_PASS_TYPES } },
          team: { type: "string", enum: ["home", "away"] },
          player: { type: "string", description: "Full or partial player name" },
          ...minuteRange,
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_player_report",
      description: "Detailed stats for one player: passes, shots, xG, goals, assists, defensive actions, fouls, cards, substitutions.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Full or partial player name" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
];

const clampMinute = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 95) : fallback;
};

function findPlayers(match: Match, query: string) {
  const q = query.trim().toLowerCase();
  return (["home", "away"] as TeamSide[]).flatMap((side) =>
    match[side].players.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ ...p, side })),
  );
}

export function runTool(name: string, rawArgs: Record<string, unknown>, ctx: ToolContext): ToolOutput {
  const { match, played } = ctx;
  const current = played.at(-1)?.minute ?? 0;

  switch (name) {
    case "get_match_overview": {
      const s = computeState(match, played);
      return {
        label: "Match overview",
        result: {
          minute: s.minute,
          period: s.period,
          score: { [match.home.name]: s.score.home, [match.away.name]: s.score.away },
          stats: { [match.home.name]: s.stats.home, [match.away.name]: s.stats.away },
          momentumNow: s.momentum,
          keyMoments: s.keyMoments.map((k) => ({ minute: k.minute, title: k.title, evidence: k.evidence })),
        },
      };
    }

    case "get_stats_between": {
      const from = clampMinute(rawArgs.from, 0);
      const to = Math.min(clampMinute(rawArgs.to, current), current);
      const windowEvents = played.filter((e) => e.minute >= from && e.minute <= to);
      const s = computeState(match, windowEvents);
      return {
        label: `Stats ${from}'–${to}'`,
        result: {
          from, to,
          goalsInWindow: s.keyMoments.filter((k) => k.kind === "goal").map((k) => `${k.minute}' ${k.title}`),
          [match.home.name]: s.stats.home,
          [match.away.name]: s.stats.away,
        },
      };
    }

    case "get_momentum": {
      const from = Math.max(1, clampMinute(rawArgs.from, 1));
      const to = Math.min(clampMinute(rawArgs.to, current), current);
      const series = computeState(match, played).momentumSeries.slice(from - 1, to);
      if (!series.length) return { label: "Momentum", result: { error: "No momentum data for that window yet." } };
      const avg = Math.round(series.reduce((a, b) => a + b, 0) / series.length);
      const snapshots = series
        .map((value, i) => ({ minute: from + i, value }))
        .filter((p, i, arr) => p.minute % 5 === 0 || i === arr.length - 1);
      return {
        label: `Momentum ${from}'–${to}'`,
        result: {
          scale: `-100 to +100, positive = ${match.home.name} on top`,
          from, to, average: avg, highest: Math.max(...series), lowest: Math.min(...series), snapshots,
        },
      };
    }

    case "find_events": {
      const from = clampMinute(rawArgs.from, 0);
      const to = clampMinute(rawArgs.to, 95);
      const types = Array.isArray(rawArgs.types) ? (rawArgs.types as string[]) : null;
      const team = rawArgs.team === "home" || rawArgs.team === "away" ? rawArgs.team : null;
      const playerIds = typeof rawArgs.player === "string" && rawArgs.player.trim()
        ? new Set(findPlayers(match, rawArgs.player).map((p) => p.id))
        : null;

      const matches = played.filter((e) =>
        e.type !== "pass" &&
        e.minute >= from && e.minute <= to &&
        (!types || types.includes(e.type)) &&
        (!team || e.team === team) &&
        (!playerIds || playerIds.has(e.playerId ?? "") || playerIds.has(e.secondaryPlayerId ?? "")),
      );
      return {
        label: `Events ${from}'–${Math.min(to, current)}'`,
        result: {
          total: matches.length,
          events: matches.slice(-25).map((e) => `${e.minute}' ${describeEvent(e, match)}`),
        },
      };
    }

    case "get_player_report": {
      const query = String(rawArgs.name ?? "");
      const found = findPlayers(match, query);
      if (found.length === 0) return { label: `Player "${query}"`, result: { error: `No player matches "${query}".` } };
      if (found.length > 1) {
        return { label: `Player "${query}"`, result: { error: "Several players match. Ask which one.", candidates: found.map((p) => `${p.name} (${match[p.side].shortName})`) } };
      }
      const p = found[0];
      const mine = played.filter((e) => e.playerId === p.id);
      const count = (type: EventType) => mine.filter((e) => e.type === type).length;
      const passes = mine.filter((e) => e.type === "pass");
      const shots = mine.filter((e) => e.type === "shot" || e.type === "shot_on_target");
      const subOn = played.find((e) => e.type === "substitution" && e.playerId === p.id);
      const subOff = played.find((e) => e.type === "substitution" && e.secondaryPlayerId === p.id);
      return {
        label: `Player: ${p.name}`,
        result: {
          name: p.name, team: match[p.side].name, position: p.position, starter: p.number <= 11,
          passes: passes.length,
          passAccuracy: passes.length ? Math.round((passes.filter((e) => e.outcome === "success").length / passes.length) * 100) : null,
          shots: shots.length,
          shotsOnTarget: count("shot_on_target"),
          xG: Math.round(shots.reduce((s, e) => s + (e.xG ?? 0), 0) * 100) / 100,
          goals: count("goal"),
          assists: played.filter((e) => e.type === "goal" && e.secondaryPlayerId === p.id).length,
          tackles: count("tackle"),
          interceptions: count("interception"),
          saves: count("save"),
          fouls: count("foul"),
          yellowCards: count("yellow_card"),
          redCards: count("red_card"),
          subbedOnAt: subOn?.minute ?? null,
          subbedOffAt: subOff?.minute ?? null,
        },
      };
    }

    default:
      return { label: name, result: { error: `Unknown tool ${name}` } };
  }
}