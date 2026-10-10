import { loadMatch } from "@/lib/data/adapter";
import { buildFabricTables, isFabricTable } from "@/lib/export/fabric";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  if (!isFabricTable(table)) return new Response("Unknown table", { status: 404 });

  const match = await loadMatch();
  const csv = buildFabricTables(match)[table];

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="matchmind_${table}.csv"`,
    },
  });
}