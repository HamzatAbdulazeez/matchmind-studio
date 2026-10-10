import type { CommentaryLine } from "@/types/ai";
import type { Match, MatchEvent, MatchState } from "@/types/match";
import { describeEvent } from "@/lib/engine/describe";
import { TOP_SPEED_TAG } from "@/lib/engine/analysis";
import { controlLabel, type ViewerProfile } from "@/lib/personalize";
import { askJSON } from "./client";
import { commentarySystem } from "./prompts";
import { toPersonalization } from "./profile";
import { translate } from "./translator";
import type { Language } from "./options";

const NOTABLE = new Set<MatchEvent["type"]>([
  "kickoff", "goal", "shot_on_target", "save", "yellow_card",
  "red_card", "substitution", "half_time", "full_time",
]);

export function isNotable(e: MatchEvent, focusPlayerId?: string): boolean {
  if (NOTABLE.has(e.type)) return true;
  if (e.type === "shot" && (e.xG ?? 0) >= 0.2) return true;
  if (e.type === "sprint" && (e.speed ?? 0) >= TOP_SPEED_TAG + 1) return true;
  if (focusPlayerId && (e.playerId === focusPlayerId || e.secondaryPlayerId === focusPlayerId)) {
    if (e.type === "pass") return e.outcome === "success" && (e.difficulty ?? 0) >= 0.7;
    return ["tackle", "interception", "pressure", "sprint", "shot", "foul"].includes(e.type);
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CommentaryEngine {
  private pending: string[] = [];
  private history: string[] = [];
  private seenMoments = new Set<string>();
  private busy = false;
  private state: MatchState | null = null;
  private count = 0;

  constructor(
    private readonly match: Match,
    private readonly language: Language,
    private readonly profile: ViewerProfile,
    private readonly onLine: (line: CommentaryLine) => void,
  ) {}

  push(event: MatchEvent, state: MatchState) {
    this.state = state;
    const focus = this.profile.mode === "player" ? this.profile.playerId : undefined;
    if (isNotable(event, focus)) this.pending.push(`${event.minute}' ${describeEvent(event, this.match)}`);

    // Explainability moments that aren't single events: momentum, pressing, chaos, milestones
    for (const k of state.keyMoments) {
      if (this.seenMoments.has(k.id)) continue;
      this.seenMoments.add(k.id);
      if (["momentum_shift", "pressure_shift", "chaos", "milestone"].includes(k.kind)) {
        this.pending.push(`${k.minute}' ${k.title} (${k.evidence[0]})`);
      }
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
    const focus = state.players.find((p) => p.id === this.profile.playerId);
    const prompt = `Minute ${state.minute}. Score: ${home.name} ${state.score.home}-${state.score.away} ${away.name}.
Momentum index: ${state.momentum} (-100 to +100, positive = ${home.name}).
Control: ${state.control}/100 (${controlLabel(state.control)}). Tempo: ${state.tempo} on-ball events per minute.
xG so far: ${home.shortName} ${state.stats.home.xG}, ${away.shortName} ${state.stats.away.xG}.
Pressures so far: ${home.shortName} ${state.stats.home.pressures}, ${away.shortName} ${state.stats.away.pressures}.${
      focus && this.profile.mode === "player"
        ? `\nFocus player ${focus.name}: ${focus.passes} passes (${focus.passAccuracy}%), ${focus.shots} shots, ${focus.pressures} pressures, top speed ${focus.topSpeed} km/h, ${focus.distanceKm} km covered.`
        : ""
    }
Latest events:
${batch.join("\n")}
Your previous lines (do not repeat):
${this.history.join("\n") || "none"}`;

    const res = await askJSON<{ line: string }>(commentarySystem(toPersonalization(this.profile, this.match)), prompt, 0.8);
    return res?.line?.trim() || null;
  }
}