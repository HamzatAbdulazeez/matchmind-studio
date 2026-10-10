import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";
import { askJSON } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context";
import { EXPLAIN_SYSTEM } from "@/lib/ai/prompts";
import { fallbackExplanation } from "@/lib/ai/fallback";
import type { Explanation } from "@/types/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const minute = Number(body.minute) || 90;

  // Recompute on the server so the AI only sees trusted data
  const match = await loadMatch();
  const played = match.events.filter((e) => e.minute <= minute);
  const state = computeState(match, played);
  const moment = state.keyMoments.find((m) => m.id === body.momentId);
  if (!moment) return NextResponse.json({ error: "Moment not found" }, { status: 404 });

  const series = state.momentumSeries;
  const m = moment.minute;
  const prompt = `${buildContext(match, state, played)}

MOMENT TO EXPLAIN:
${m}' ${moment.title}
Evidence: ${moment.evidence.join("; ")}
Momentum 5 mins before: ${series[m - 6] ?? 0}, at the moment: ${series[m - 1] ?? 0}, 5 mins after: ${series[m + 4] ?? "not played yet"}`;

  try {
    const result = await askJSON<Omit<Explanation, "source">>(EXPLAIN_SYSTEM, prompt);
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
