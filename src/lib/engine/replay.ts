import type { Match, MatchEvent, MatchState } from "@/types/match";
import { computeState } from "./analysis";

export interface ReplayTick {
  event: MatchEvent;
  state: MatchState;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });

/** Replays a match in accelerated real time. speed = match seconds per real second. */
export async function* replayMatch(match: Match, speed = 60, signal?: AbortSignal): AsyncGenerator<ReplayTick> {
  const played: MatchEvent[] = [];
  let lastT = 0;

  for (const event of match.events) {
    if (signal?.aborted) return;
    const t = event.minute * 60 + event.second;
    const wait = ((t - lastT) / speed) * 1000;
    if (wait > 0) await sleep(wait, signal);
    if (signal?.aborted) return;
    lastT = Math.max(lastT, t);
    played.push(event);
    yield { event, state: computeState(match, played) };
  }
}
