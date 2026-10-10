import { loadMatch } from "@/lib/data/adapter";
import { replayMatch } from "@/lib/engine/replay";
import { CommentaryEngine } from "@/lib/ai/commentary";
import { isLanguage } from "@/lib/ai/options";
import { parseProfile } from "@/lib/ai/profile";
import { cuesForEvent, QuarterTracker } from "@/lib/overlay/cues";
import type { MatchMeta } from "@/types/match";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const speed = Math.min(Math.max(Number(params.get("speed")) || 60, 1), 600);
  const langParam = params.get("lang");
  const language = isLanguage(langParam) ? langParam : "English";
  const commentaryOn = params.get("commentary") !== "off";

  const match = await loadMatch();
  const profile = parseProfile(Object.fromEntries(params), match);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const commentary = new CommentaryEngine(match, language, profile, (line) => send("commentary", line));
      const seenMoments = new Set<string>();
      const quarters = new QuarterTracker();

      try {
        const meta: MatchMeta = {
          id: match.id, competition: match.competition, venue: match.venue,
          kickoff: match.kickoff, home: match.home, away: match.away,
        };
        send("meta", meta);

        for await (const tick of replayMatch(match, speed, req.signal)) {
          send("tick", tick);
          const fresh = tick.state.keyMoments.filter((k) => !seenMoments.has(k.id));
          fresh.forEach((k) => seenMoments.add(k.id));
          for (const c of [...cuesForEvent(match, tick.event, tick.state, fresh), ...quarters.check(tick.event, tick.state)]) send("cue", c);
          if (commentaryOn) commentary.push(tick.event, tick.state);
        }

        if (!req.signal.aborted) {
          if (commentaryOn) await commentary.drain();
          send("end", {});
        }
      } catch {
        // client disconnected
      } finally {
        closed = true;
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}