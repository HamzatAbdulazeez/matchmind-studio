import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";

export const dynamic = "force-dynamic";

// Full match + final state — used for recaps and debugging
export async function GET() {
  const match = await loadMatch();
  return NextResponse.json({ match, finalState: computeState(match, match.events) });
}
