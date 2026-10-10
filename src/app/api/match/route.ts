import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";
import type { MatchMeta } from "@/types/match";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const match = await loadMatch();
  if (new URL(req.url).searchParams.get("meta")) {
    const { events, ...meta } = match;
    void events;
    return NextResponse.json(meta satisfies MatchMeta);
  }
  return NextResponse.json({ match, finalState: computeState(match, match.events) });
}