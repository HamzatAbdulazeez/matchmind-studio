import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";
import { askJSON } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context";
import { explainSystem } from "@/lib/ai/prompts";
import { parseProfile, toPersonalization } from "@/lib/ai/profile";
import { fallbackExplanation } from "@/lib/ai/fallback";
import type { Explanation } from "@/types/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const minute = Number(body.minute) || 90;

  const match = await loadMatch();
  const played = match.events.filter((e) => e.minute <= minute);
  const state = computeState(match, played);
  const moment = state.keyMoments.find((m) => m.id === body.momentId);
  if (!moment) return NextResponse.json({ error: "Moment not found" }, { status: 404 });

  const profile = parseProfile(body, match);
  const at = (minute: number) => state.timeline[minute - 1];
  const describe = (minute: number) => {
    const p = at(minute);
    return p ? `momentum ${p.momentum}, control ${p.control}/100, tempo ${p.tempo}, pressures ${match.home.shortName} ${p.pressure.home} / ${match.away.shortName} ${p.pressure.away}` : "not played yet";
  };
  const m = moment.minute;
  const prompt = `${buildContext(match, state, played, profile.playerId)}

MOMENT TO EXPLAIN:
${m}' ${moment.title}
Evidence: ${moment.evidence.join("; ")}
5 mins before: ${describe(m - 5)}
At the moment: ${describe(m)}
5 mins after: ${describe(m + 5)}`;

  try {
    const result = await askJSON<Omit<Explanation, "source">>(explainSystem(toPersonalization(profile, match)), prompt);
    if (result?.explanation) {
      const explanation: Explanation = {
        headline: result.headline || moment.title,
        explanation: result.explanation,
        evidence: Array.isArray(result.evidence) ? result.evidence : moment.evidence,
        source: "ai",
      };
      return NextResponse.json(explanation);
    }
  } catch (err) {
    console.error("Explain failed:", err);
  }
  return NextResponse.json(fallbackExplanation(moment));
}