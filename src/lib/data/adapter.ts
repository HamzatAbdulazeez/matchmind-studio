import { readFile } from "fs/promises";
import type { Match } from "@/types/match";
import { generateMatch } from "./synthetic";

let cached: Match | null = null;

/** Single entry point for match data. Swap in the official dataset here. */
export async function loadMatch(): Promise<Match> {
  if (cached) return cached;
  const path = process.env.MATCH_DATA_PATH;
  cached = path
    ? normalizeOfficialData(JSON.parse(await readFile(path, "utf8")))
    : generateMatch(Number(process.env.MATCH_SEED ?? 2026));
  return cached;
}

/** TODO: map the official hackathon schema to our Match type once it's released. */
export function normalizeOfficialData(raw: unknown): Match {
  const data = raw as Partial<Match> | null;
  if (data?.events && data?.home && data?.away) return data as Match;
  throw new Error("Unknown dataset format — update normalizeOfficialData() in src/lib/data/adapter.ts");
}
