import { NextResponse } from "next/server";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";
import { askJSON } from "@/lib/ai/client";
import { buildContext } from "@/lib/ai/context";
import { recapSystem } from "@/lib/ai/prompts";
import { parseProfile, toPersonalization } from "@/lib/ai/profile";
import { fallbackRecap } from "@/lib/ai/fallback";
import { isLanguage, isRecapStyle, TRANSLATOR_PREFERRED } from "@/lib/ai/options";
import { translate, translatorEnabled } from "@/lib/ai/translator";
import type { Recap } from "@/types/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const style = isRecapStyle(body.style) ? body.style : "tv";
  const language = isLanguage(body.language) ? body.language : "English";
  const minute = Number(body.minute) || 90;

  const match = await loadMatch();
  const played = match.events.filter((e) => e.minute <= minute);
  const state = computeState(match, played);
  const profile = parseProfile(body, match);

  // For Yoruba, Hausa, Igbo and Swahili: write in English, then translate with Azure AI Translator
  const useTranslator = translatorEnabled() && TRANSLATOR_PREFERRED.includes(language);
  const writeIn = useTranslator ? "English" : language;

  try {
    const result = await askJSON<Omit<Recap, "source">>(
      recapSystem(style, writeIn, toPersonalization(profile, match)),
      buildContext(match, state, played, profile.playerId),
      0.7,
    );
    if (result?.body) {
      if (useTranslator) {
        const t = await translate([result.title, result.body], language);
        if (t) return NextResponse.json({ title: t[0], body: t[1], source: "ai" } satisfies Recap);
      }
      return NextResponse.json({ title: result.title, body: result.body, source: "ai" } satisfies Recap);
    }
  } catch (err) {
    console.error("Recap failed:", err);
  }

  const fallback = fallbackRecap(match, state);
  const t = await translate([fallback.title, fallback.body], language);
  return NextResponse.json(t ? { ...fallback, title: t[0], body: t[1] } : fallback);
}