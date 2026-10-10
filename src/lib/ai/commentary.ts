import type { CommentaryLine } from "@/types/ai";
import type { Match, MatchEvent, MatchState } from "@/types/match";
import { describeEvent } from "@/lib/engine/describe";
import { askJSON } from "./client";
import { COMMENTARY_SYSTEM } from "./prompts";
import { translate } from "./translator";
import type { Language } from "./options";

const NOTABLE = new Set<MatchEvent["type"]>([
  "kickoff", "goal", "shot_on_target", "save", "yellow_card",
  "red_card", "substitution", "half_time", "full_time",
]);

export function isNotable(e: MatchEvent): boolean {
  return NOTABLE.has(e.type) || (e.type === "shot" && (e.xG ?? 0) >= 0.2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CommentaryEngine {
  private pending: string[] = [];
  private history: string[] = [];
  private busy = false;
  private state: MatchState | null = null;
  private shiftCount = 0;
  private count = 0;

  constructor(
    private readonly match: Match,
    private readonly language: Language,
    private readonly onLine: (line: CommentaryLine) => void,
  ) {}

  push(event: MatchEvent, state: MatchState) {
    this.state = state;
    if (isNotable(event)) this.pending.push(`${event.minute}' ${describeEvent(event, this.match)}`);

    const shifts = state.keyMoments.filter((k) => k.kind === "momentum_shift");
    if (shifts.length > this.shiftCount) {
      this.shiftCount = shifts.length;
      const s = shifts[shifts.length - 1];
      this.pending.push(`${s.minute}' ${s.title} (${s.evidence[0]})`);
    }
    void this.flush();
  }

  /** Waits for in-flight commentary to finish (used before the stream ends). */
  async drain(timeoutMs = 10_000) {
    const end = Date.now() + timeoutMs;
    while ((this.busy || this.pending.length) && Date.now() < end) await sleep(100);
  }

  private async flush() {
    if (this.busy || !this.pending.length || !this.state) return;
    this.busy = true;
    const batch = this.pending.splice(0).slice(-4);
    const state = this.state;

    try {
      let text: string | null = null;
      try {
        text = await this.generate(batch, state);
      } catch (err) {
        console.error("Commentary AI failed:", err);
      }
      const source: CommentaryLine["source"] = text ? "ai" : "fallback";
      const line = text ?? batch[batch.length - 1].replace(/^\d+' /, "");

      const translated = (await translate([line], this.language))?.[0];
      this.history = [...this.history, line].slice(-4);
      this.onLine({ id: `c${++this.count}`, minute: state.minute, text: line, translated, language: this.language, source });
    } finally {
      this.busy = false;
      if (this.pending.length) void this.flush();
    }
  }

  private async generate(batch: string[], state: MatchState): Promise<string | null> {
    const { home, away } = this.match;
    const prompt = `Minute ${state.minute}. Score: ${home.name} ${state.score.home}-${state.score.away} ${away.name}.
Momentum index: ${state.momentum} (-100 to +100, positive = ${home.name}).
xG so far: ${home.shortName} ${state.stats.home.xG}, ${away.shortName} ${state.stats.away.xG}.
Latest events:
${batch.join("\n")}
Your previous lines (do not repeat):
${this.history.join("\n") || "none"}`;

    const res = await askJSON<{ line: string }>(COMMENTARY_SYSTEM, prompt, 0.8);
    return res?.line?.trim() || null;
  }
}