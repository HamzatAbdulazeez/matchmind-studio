import type { Explanation, Recap } from "@/types/ai";
import type { KeyMoment, Match, MatchState } from "@/types/match";

export function fallbackExplanation(moment: KeyMoment): Explanation {
  return {
    headline: moment.title,
    explanation: "Here is the data behind this moment.",
    evidence: moment.evidence,
    source: "fallback",
  };
}

export function fallbackRecap(match: Match, state: MatchState): Recap {
  const { home, away } = match;
  const h = state.stats.home;
  const a = state.stats.away;
  const goals = state.keyMoments
    .filter((k) => k.kind === "goal")
    .map((k) => `${k.minute}' ${k.title.replace("GOAL: ", "")}`);

  return {
    title: `${home.name} ${state.score.home}-${state.score.away} ${away.name}`,
    body:
      `${state.period === "full_time" ? "Full-time" : `Minute ${state.minute}`}. ` +
      `${home.shortName} had ${h.possession}% of the ball and created ${h.xG} xG from ${h.shots} shots; ` +
      `${away.shortName} produced ${a.xG} xG from ${a.shots}. ` +
      `${goals.length ? `Goals: ${goals.join(", ")}.` : "No goals yet."}\n\n` +
      "(Template recap — connect Azure OpenAI for AI-written recaps.)",
    source: "fallback",
  };
}