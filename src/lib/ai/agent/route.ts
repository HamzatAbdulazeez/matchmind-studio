import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { loadMatch } from "@/lib/data/adapter";
import { computeState } from "@/lib/engine/analysis";
import { getAI } from "@/lib/ai/client";
import { AGENT_TOOLS, runTool } from "@/lib/agent/tools";
import { agentSystem } from "@/lib/agent/prompt";

export const dynamic = "force-dynamic";

const MAX_STEPS = 6;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function isTurn(m: unknown): m is ChatTurn {
  const t = m as ChatTurn;
  return (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string" && t.content.length < 2000;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const minute = Number(body.minute) || 90;
  const history: ChatTurn[] = Array.isArray(body.messages) ? body.messages.filter(isTurn).slice(-10) : [];
  if (!history.length || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send a question first." }, { status: 400 });
  }

  const match = await loadMatch();
  const played = match.events.filter((e) => e.minute <= minute);
  const ai = getAI();

  if (!ai) {
    const s = computeState(match, played);
    return NextResponse.json({
      answer:
        `AI is offline, so here is the overview instead. At ${s.minute}' it's ${match.home.name} ${s.score.home}-${s.score.away} ${match.away.name}. ` +
        `xG is ${s.stats.home.xG} to ${s.stats.away.xG}, shots ${s.stats.home.shots} to ${s.stats.away.shots}, and the momentum index is ${s.momentum}. ` +
        "Add your Azure OpenAI keys to ask real questions.",
      trace: ["Match overview"],
      source: "fallback",
    });
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: agentSystem(match, minute) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const trace: string[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await ai.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages,
        tools: AGENT_TOOLS,
        temperature: 0.3,
        max_tokens: 700,
      });
      const msg = res.choices[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            // keep empty args
          }
          const { result, label } = runTool(call.function.name, args, { match, played });
          trace.push(label);
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
        continue;
      }

      return NextResponse.json({ answer: msg.content ?? "", trace: [...new Set(trace)], source: "ai" });
    }

    return NextResponse.json({
      answer: "I couldn't finish that analysis. Try a narrower question, for example one about a specific minute range or player.",
      trace: [...new Set(trace)],
      source: "ai",
    });
  } catch (err) {
    console.error("Agent failed:", err);
    return NextResponse.json({ error: "The assistant couldn't reach Azure OpenAI. Check your keys and deployment name." }, { status: 502 });
  }
}