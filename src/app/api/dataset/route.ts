import { loadMatch } from "@/lib/data/adapter";

export const dynamic = "force-dynamic";

export async function GET() {
  const match = await loadMatch();
  return new Response(JSON.stringify(match, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${match.id}.json"`,
    },
  });
}