/**
 * Uploads the Fabric tables straight into a Microsoft Fabric Lakehouse (OneLake Files).
 * Run: az login   (with an account that can access the workspace)
 *      npm run upload:onelake
 *
 * Needs in .env.local:
 *   FABRIC_WORKSPACE=your workspace name (or GUID)
 *   FABRIC_LAKEHOUSE=your lakehouse name
 */
import { DefaultAzureCredential } from "@azure/identity";
import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { loadMatch } from "../src/lib/data/adapter";
import { buildFabricTables } from "../src/lib/export/fabric";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local
}

async function main() {
  const workspace = process.env.FABRIC_WORKSPACE;
  const lakehouse = process.env.FABRIC_LAKEHOUSE;
  if (!workspace || !lakehouse) {
    throw new Error("Set FABRIC_WORKSPACE and FABRIC_LAKEHOUSE in .env.local first.");
  }

  const service = new DataLakeServiceClient("https://onelake.dfs.fabric.microsoft.com", new DefaultAzureCredential());
  const fileSystem = service.getFileSystemClient(workspace);

  const match = await loadMatch();
  const tables = buildFabricTables(match);
  const folder = `${lakehouse}.Lakehouse/Files/matchmind/${match.id}`;

  for (const [name, csv] of Object.entries(tables)) {
    const path = `${folder}/${name}.csv`;
    await fileSystem.getFileClient(path).upload(Buffer.from(csv, "utf8"));
    console.log(`Uploaded ${path}`);
  }
  console.log("\nDone. In Fabric, open the Lakehouse, go to Files > matchmind, and use 'Load to Tables' on each file.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});