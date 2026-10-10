import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { loadMatch } from "../src/lib/data/adapter";
import { buildFabricTables } from "../src/lib/export/fabric";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — use defaults
}

async function main() {
  const match = await loadMatch();
  const tables = buildFabricTables(match);
  const dir = join(process.cwd(), "fabric-export", match.id);
  await mkdir(dir, { recursive: true });

  for (const [name, csv] of Object.entries(tables)) {
    const file = join(dir, `${name}.csv`);
    await writeFile(file, csv, "utf8");
    console.log(`Wrote ${file} (${csv.split("\n").length - 2} rows)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});