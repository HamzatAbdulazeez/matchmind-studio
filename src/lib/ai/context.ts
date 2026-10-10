import type { Match, MatchEvent, MatchState } from "@/types/match";
import { describeEvent } from "@/lib/engine/describe";

/** Compact, factual match summary the AI is grounded on. */
export function buildContext(match: Match, state: MatchState, played: MatchEvent[]): string {
  const { home, away } = match;
  const h = state.stats.home;
  const a = state.stats.away;

  const blocks: string[] = [];
  for (let i = 0; i < state.momentumSeries.length; i += 15) {
    const chunk = state.momentumSeries.slice(i, i + 15);
    const avg = Math.round(chunk.reduce((s, v) => s + v, 0) / chunk.length);
    blocks.push(`${i + 1}-${i + chunk.length}': ${avg > 0 ? "+" : ""}${avg}`);
  }

  const log = played
    .filter((e) => !["pass", "tackle", "interception"].includes(e.type))
    .map((e) => `${e.minute}' ${describeEvent(e, match)}`);

  const moments = state.keyMoments
    .map((k) => `- ${k.minute}' ${k.title} [${k.evidence.join("; ")}]`)
    .join("\n");

  return `MATCH DATA (synthetic)
Fixture: ${home.name} (home, ${home.shortName}) vs ${away.name} (away, ${away.shortName}) — ${match.competition}, ${match.venue}
Status: ${state.period.replace("_", " ")}, minute ${state.minute}
Score: ${home.shortName} ${state.score.home}-${state.score.away} ${away.shortName}
Stats (${home.shortName} | ${away.shortName}):
- Possession: ${h.possession}% | ${a.possession}%
- xG: ${h.xG} | ${a.xG}
- Shots (on target): ${h.shots} (${h.shotsOnTarget}) | ${a.shots} (${a.shotsOnTarget})
- Pass accuracy: ${h.passAccuracy}% | ${a.passAccuracy}%
- Corners: ${h.corners} | ${a.corners}
- Fouls: ${h.fouls} | ${a.fouls}
- Cards (Y/R): ${h.yellowCards}/${h.redCards} | ${a.yellowCards}/${a.redCards}
Momentum index (-100 to +100, positive = ${home.shortName}) by period: ${blocks.join(", ") || "n/a"}
Key moments:
${moments || "- none"}
Event log:
${log.join("\n")}`;
}
