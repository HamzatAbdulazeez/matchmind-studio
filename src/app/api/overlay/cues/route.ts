import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";
import { buildCueSheet } from "@/lib/overlay/cues";

export const dynamic = "force-dynamic";

let cache: { matchId: string; cues: ReturnType<typeof buildCueSheet> } | null = null;

export async function GET() {
  const match = await loadMatch();
  if (cache?.matchId !== match.id) {
    cache = { matchId: match.id, cues: buildCueSheet(match, (events) => computeState(match, events)) };
  }
  return NextResponse.json({
    matchId: match.id,
    format: "matchmind.overlay-cues.v1",
    clock: "matchSeconds = minute * 60 + second, from kick-off",
    count: cache.cues.length,
    cues: cache.cues,
  });
}