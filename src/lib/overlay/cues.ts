import type { KeyMoment, Match, MatchEvent, MatchState, TeamSide } from "@/types/match";
import { HARD_PASS, TOP_SPEED_TAG } from "@/lib/engine/analysis";
import { controlLabel } from "@/lib/personalize";

export type CueTemplate = "goal" | "card" | "shot" | "player_tag" | "hard_pass" | "insight" | "stat_compare";

export interface OverlayCue {
  id: string;
  matchClock: { minute: number; second: number };
  matchSeconds: number; 
  durationSec: number; 
  template: CueTemplate;
  priority: number; // 1 (low) – 10 (interrupts anything)
  position: "lower_third" | "top_right" | "centre";
  team?: TeamSide;
  data: Record<string, string | number | boolean | null>;
}

const PRIORITY: Record<CueTemplate, number> = {
  goal: 10, card: 8, insight: 6, shot: 5, player_tag: 4, hard_pass: 3, stat_compare: 2,
};

function cue(e: { minute: number; second: number }, id: string, template: CueTemplate, durationSec: number, data: OverlayCue["data"], team?: TeamSide, position: OverlayCue["position"] = "lower_third"): OverlayCue {
  return {
    id, template, team, data, durationSec, position,
    priority: PRIORITY[template],
    matchClock: { minute: e.minute, second: e.second },
    matchSeconds: e.minute * 60 + e.second,
  };
}

/** Cues triggered by one new event, given the match state right after it. */
export function cuesForEvent(match: Match, event: MatchEvent, state: MatchState, newMoments: KeyMoment[]): OverlayCue[] {
  const out: OverlayCue[] = [];
  const player = state.players.find((p) => p.id === event.playerId);
  const teamName = match[event.team].name;

  switch (event.type) {
    case "goal":
      out.push(cue(event, `cue-${event.id}`, "goal", 12, {
        scorer: player?.name ?? null, teamName, shortName: match[event.team].shortName,
        score: `${state.score.home}-${state.score.away}`, xG: event.xG ?? null, shotSpeedKmh: event.speed ?? null,
        assist: state.players.find((p) => p.id === event.secondaryPlayerId)?.name ?? null,
      }, event.team, "centre"));
      break;
    case "red_card":
    case "yellow_card":
      out.push(cue(event, `cue-${event.id}`, "card", 8, { colour: event.type === "red_card" ? "red" : "yellow", player: player?.name ?? null, teamName }, event.team));
      break;
    case "shot":
    case "shot_on_target":
      if ((event.xG ?? 0) >= 0.15 || (event.speed ?? 0) >= 100) {
        out.push(cue(event, `cue-${event.id}`, "shot", 6, {
          player: player?.name ?? null, teamName, xG: event.xG ?? null, shotSpeedKmh: event.speed ?? null,
          onTarget: event.type === "shot_on_target",
        }, event.team));
      }
      break;
    case "sprint":
      if ((event.speed ?? 0) >= TOP_SPEED_TAG && player) {
        out.push(cue(event, `cue-${event.id}`, "player_tag", 5, {
          player: player.name, number: player.number, teamName, speedKmh: event.speed ?? null,
          distanceKm: player.distanceKm, threshold: `${TOP_SPEED_TAG} km/h`,
        }, event.team, "top_right"));
      }
      break;
    case "pass":
      if (event.outcome === "success" && (event.difficulty ?? 0) >= Math.max(HARD_PASS, 0.85) && (event.x ?? 0) > 70 && player) {
        out.push(cue(event, `cue-${event.id}`, "hard_pass", 5, {
          player: player.name, teamName, distanceM: event.distance ?? null, difficulty: event.difficulty ?? null,
        }, event.team));
      }
      break;
  }

  for (const k of newMoments) {
    if (k.kind === "goal" || k.kind === "red_card") continue; // already covered by their own cue
    out.push(cue({ minute: k.minute, second: event.second }, `cue-${k.id}`, "insight", 9, {
      kind: k.kind, title: k.title, why: k.evidence[0] ?? null, detail: k.evidence[1] ?? null,
    }, k.team));
  }

  return out;
}

const QUARTERS = [15, 30, 60, 75];

/** Builds the full cue sheet for a match by replaying it. */
export function buildCueSheet(match: Match, compute: (events: MatchEvent[]) => MatchState): OverlayCue[] {
  const played: MatchEvent[] = [];
  const seen = new Set<string>();
  const sheet: OverlayCue[] = [];
  const tracker = new QuarterTracker();
  for (const e of match.events) {
    played.push(e);
    const state = compute(played);
    const fresh = state.keyMoments.filter((k) => !seen.has(k.id));
    fresh.forEach((k) => seen.add(k.id));
    sheet.push(...cuesForEvent(match, e, state, fresh), ...tracker.check(e, state));
  }
  return sheet;
}

/** Emits a stat comparison cue the first time each 15-minute mark is passed. */
export class QuarterTracker {
  private done = new Set<number>();
  check(event: MatchEvent, state: MatchState): OverlayCue[] {
    for (const q of QUARTERS) {
      if (event.minute >= q && !this.done.has(q)) {
        this.done.add(q);
        return [cue({ minute: q, second: 0 }, `cue-stats-${q}`, "stat_compare", 10, {
          title: `After ${q} minutes`,
          possession: `${state.stats.home.possession}-${state.stats.away.possession}`,
          xG: `${state.stats.home.xG}-${state.stats.away.xG}`,
          pressures: `${state.stats.home.pressures}-${state.stats.away.pressures}`,
          control: state.control, controlLabel: controlLabel(state.control),
        }, undefined, "top_right")];
      }
    }
    return [];
  }
}