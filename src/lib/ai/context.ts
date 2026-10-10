import type { Match, MatchEvent, MatchState } from "@/types/match";
import { describeEvent } from "@/lib/engine/describe";
import { isLoggable } from "@/lib/engine/analysis";
import { controlLabel } from "@/lib/personalize";

export function buildContext(match: Match, state: MatchState, played: MatchEvent[], focusPlayerId?: string): string {
  const { home, away } = match;
  const h = state.stats.home;
  const a = state.stats.away;

  const phases: string[] = [];
  for (let i = 0; i < state.timeline.length; i += 15) {
    const chunk = state.timeline.slice(i, i + 15);
    const avg = (f: (p: (typeof chunk)[number]) => number) => Math.round(chunk.reduce((s, p) => s + f(p), 0) / chunk.length);
    const mom = avg((p) => p.momentum);
    const ctrl = avg((p) => p.control);
    phases.push(
      `${chunk[0].minute}-${chunk.at(-1)!.minute}': momentum ${mom > 0 ? "+" : ""}${mom}, control ${ctrl}/100 (${controlLabel(ctrl)}), ` +
      `tempo ${avg((p) => p.tempo)} on-ball events/min, pressures ${home.shortName} ${chunk.reduce((s, p) => s + p.pressure.home, 0) / 5 | 0} / ${away.shortName} ${chunk.reduce((s, p) => s + p.pressure.away, 0) / 5 | 0}`,
    );
  }

  const log = played.filter(isLoggable).map((e) => `${e.minute}' ${describeEvent(e, match)}`);
  const moments = state.keyMoments.map((k) => `- ${k.minute}' ${k.title} [${k.evidence.join("; ")}]`).join("\n");

  const top = (key: "distanceKm" | "topSpeed" | "xG" | "hardPassesCompleted" | "pressures") =>
    [...state.players].sort((x, y) => y[key] - x[key]).slice(0, 3).map((p) => `${p.name} (${match[p.team].shortName}) ${p[key]}`).join(", ");

  const focus = state.players.find((p) => p.id === focusPlayerId);
  const focusBlock = focus
    ? `\nFOCUS PLAYER: ${focus.name}, ${match[focus.team].name}, ${focus.position} #${focus.number}, ${focus.onPitch ? "on the pitch" : "not on the pitch"}, ${focus.minutes} min.
Passes ${focus.passes} (${focus.passAccuracy}% accurate, avg ${focus.avgPassDistance} m, ${focus.hardPassesCompleted} hard passes completed), shots ${focus.shots}, xG ${focus.xG}, goals ${focus.goals}, assists ${focus.assists},
pressures ${focus.pressures}, tackles ${focus.tackles}, interceptions ${focus.interceptions}, sprints ${focus.sprints}, top speed ${focus.topSpeed} km/h, distance ${focus.distanceKm} km.`
    : "";

  return `MATCH DATA (synthetic)
Fixture: ${home.name} (home, ${home.shortName}) vs ${away.name} (away, ${away.shortName}), ${match.competition}, ${match.venue}
Status: ${state.period.replace("_", " ")}, minute ${state.minute}
Score: ${home.shortName} ${state.score.home}-${state.score.away} ${away.shortName}
Stats (${home.shortName} | ${away.shortName}):
- Possession: ${h.possession}% | ${a.possession}%
- xG: ${h.xG} | ${a.xG}
- Shots (on target): ${h.shots} (${h.shotsOnTarget}) | ${a.shots} (${a.shotsOnTarget}); hardest shot ${h.maxShotSpeed} | ${a.maxShotSpeed} km/h
- Pass accuracy: ${h.passAccuracy}% | ${a.passAccuracy}%; average pass ${h.avgPassDistance} | ${a.avgPassDistance} m; hard passes completed ${h.hardPassesCompleted} | ${a.hardPassesCompleted}
- Pressures: ${h.pressures} | ${a.pressures}; possession wins ${h.possessionWins} | ${a.possessionWins}
- Distance: ${h.distanceKm} | ${a.distanceKm} km; sprints ${h.sprints} | ${a.sprints}
- Corners: ${h.corners} | ${a.corners}; fouls ${h.fouls} | ${a.fouls}; cards (Y/R) ${h.yellowCards}/${h.redCards} | ${a.yellowCards}/${a.redCards}
Right now: momentum ${state.momentum} (-100 to +100, positive = ${home.shortName}), control ${state.control}/100 (${controlLabel(state.control)}), tempo ${state.tempo} on-ball events per minute
Phases: ${phases.join(" | ") || "n/a"}
Leaders: distance ${top("distanceKm")}; top speed ${top("topSpeed")}; xG ${top("xG")}; hard passes ${top("hardPassesCompleted")}; pressures ${top("pressures")}${focusBlock}
Key moments:
${moments || "- none"}
Event log:
${log.join("\n")}`;
}