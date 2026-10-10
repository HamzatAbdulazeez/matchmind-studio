import type { Match, MatchEvent, Player, Position, Team, TeamSide } from "@/types/match";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = ["Tunde", "Marcus", "Leo", "Kofi", "Daniel", "Theo", "Samir", "Jonah", "Emeka", "Luca", "Ryan", "Idris", "Callum", "Mateo", "Femi", "Owen", "Kai", "Bilal", "Noah", "Ade"];
const LAST_NAMES = ["Adeyemi", "Hart", "Okafor", "Bennett", "Mensah", "Fletcher", "Walsh", "Ibrahim", "Carter", "Novak", "Moreau", "Doyle", "Osei", "Lindqvist", "Harper", "Nwosu", "Reyes", "Quinn", "Abiola", "Grant"];

const LINEUP: Position[] = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"];
const BENCH: Position[] = ["DEF", "MID", "FWD"];
const WORK_RATE: Record<Position, [number, number]> = { GK: [55, 65], DEF: [104, 118], MID: [114, 130], FWD: [100, 116] };

export const SPRINT_THRESHOLD_KMH = 25; // a run counts as a sprint above this speed

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

function makeTeam(rand: () => number, used: Set<string>, side: TeamSide, id: string, name: string, shortName: string): Team {
  const players: Player[] = [...LINEUP, ...BENCH].map((position, i) => {
    let fullName: string;
    do {
      fullName = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`;
    } while (used.has(fullName));
    used.add(fullName);
    const [lo, hi] = WORK_RATE[position];
    return { id: `${id}-${i + 1}`, name: fullName, number: i + 1, position, workRate: Math.round(lo + rand() * (hi - lo)) };
  });
  return { id, name, shortName, side, players };
}

export function generateMatch(seed = 2026): Match {
  const rand = mulberry32(seed);
  const used = new Set<string>();
  const home = makeTeam(rand, used, "home", "nbr", "Northbridge FC", "NBR");
  const away = makeTeam(rand, used, "away", "rsa", "Riverside Athletic", "RSA");
  const teams = { home, away };

  const onPitch: Record<TeamSide, Player[]> = { home: home.players.slice(0, 11), away: away.players.slice(0, 11) };
  const benchUsed = { home: 0, away: 0 };
  const reds = { home: 0, away: 0 };

  const events: MatchEvent[] = [];
  let n = 0;
  const push = (e: Omit<MatchEvent, "id">) => { events.push({ id: `e${++n}`, ...e }); };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const other = (s: TeamSide): TeamSide => (s === "home" ? "away" : "home");
  const keeper = (s: TeamSide) => onPitch[s].find((p) => p.position === "GK")!;
  const outfield = (s: TeamSide, positions: Position[] = ["DEF", "MID", "FWD"]): Player => {
    const pool = onPitch[s].filter((p) => positions.includes(p.position));
    return pick(pool.length ? pool : onPitch[s].filter((p) => p.position !== "GK"));
  };

  push({ minute: 0, second: 0, type: "kickoff", team: "home" });
  let swing = 0;
  const press: Record<TeamSide, number> = { home: 0.3, away: 0.3 }; 
  let possessor: TeamSide = "home";

  for (let minute = 1; minute <= 90; minute++) {
    if (minute === 46) {
      push({ minute: 46, second: 0, type: "kickoff", team: "away" });
      possessor = "away";
    }

    swing = clamp(swing + (rand() - 0.5) * 0.1, -0.2, 0.2);
    for (const side of ["home", "away"] as TeamSide[]) press[side] = clamp(press[side] + (rand() - 0.5) * 0.12, 0.12, 0.62);
    const edge = (side: TeamSide) => (side === "home" ? swing : -swing) + 0.08 * (reds[other(side)] - reds[side]);
    const homeShare = 0.53 + swing + 0.08 * (reds.away - reds.home);
    const sideFor = (): TeamSide => (rand() < homeShare ? "home" : "away");
    const secs = Array.from({ length: 16 }, () => Math.floor(rand() * 60)).sort((a, b) => a - b);
    let si = 0;
    const nextSec = () => secs[Math.min(si++, secs.length - 1)];

    // Passing sequences: pressure, pass quality, turnovers
    const passes = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < passes; i++) {
      const side = possessor;
      const opp = other(side);
      const second = nextSec();
      const passer = outfield(side);
      const x = Math.floor(rand() * 100);

      const pressed = rand() < press[opp] * (x > 50 ? 1.15 : 0.85);
      if (pressed) {
        push({ minute, second, type: "pressure", team: opp, playerId: outfield(opp, x > 50 ? ["DEF", "MID"] : ["MID", "FWD"]).id, secondaryPlayerId: passer.id, x: 100 - x, y: Math.floor(rand() * 100) });
      }

      const distance = Math.round(5 + rand() ** 1.6 * 45);
      const difficulty = r2(clamp(0.08 + distance / 65 + (pressed ? 0.24 : 0) + (x > 66 ? 0.14 : 0) + (rand() - 0.5) * 0.12, 0.02, 0.98));
      const success = rand() < clamp(0.97 - difficulty * 0.42 + edge(side) * 0.4, 0.35, 0.98);
      const receiver = success ? pick(onPitch[side].filter((p) => p.id !== passer.id && p.position !== "GK")) : undefined;
      push({
        minute, second, type: "pass", team: side, playerId: passer.id, secondaryPlayerId: receiver?.id,
        x, y: Math.floor(rand() * 100), distance, difficulty, outcome: success ? "success" : "fail",
      });

      if (!success) {
        if (rand() < 0.65) {
          push({ minute, second, type: rand() < 0.5 ? "tackle" : "interception", team: opp, playerId: outfield(opp, ["DEF", "MID"]).id });
        }
        push({ minute, second, type: "possession_change", team: opp, x: 100 - x });
        possessor = opp;
      }
    }

    // Occasional switch of possession from loose balls and clearances, weighted by who is on top
    if (rand() < 0.35) {
      const winner = sideFor();
      if (winner !== possessor) {
        push({ minute, second: nextSec(), type: "possession_change", team: winner, x: Math.floor(rand() * 60) });
        possessor = winner;
      }
    }

    // Sprints: off-the-ball and on-the-ball high-speed runs
    for (const side of ["home", "away"] as TeamSide[]) {
      if (rand() < 0.55) {
        const runner = outfield(side, rand() < 0.6 ? ["FWD", "MID"] : ["DEF"]);
        const speed = Math.round((SPRINT_THRESHOLD_KMH + rand() ** 1.4 * 11.5) * 10) / 10;
        push({ minute, second: nextSec(), type: "sprint", team: side, playerId: runner.id, speed });
      }
    }

    // Chances
    if (rand() < 0.13 + Math.abs(swing) * 0.2) {
      const side = sideFor();
      const second = nextSec();
      const shooter = outfield(side, ["MID", "FWD"]);
      const xG = r2(0.03 + rand() ** 2 * 0.6);
      const onTarget = rand() < 0.35 + xG * 0.6;
      // Better chances come from closer and more central positions
      const d = 1 - Math.min(1, xG / 0.6);
      const x = Math.round(97 - d * 24 - rand() * 4);
      const y = Math.round(clamp(50 + (rand() - 0.5) * (14 + d * 50), 6, 94));
      const speed = Math.round(58 + rand() * 50 + d * 14); // long-range shots tend to be struck harder

      if (!onTarget) {
        push({ minute, second, type: "shot", team: side, playerId: shooter.id, xG, x, y, speed, outcome: "fail" });
        if (rand() < 0.3) push({ minute, second, type: "corner", team: side });
      } else {
        push({ minute, second, type: "shot_on_target", team: side, playerId: shooter.id, xG, x, y, speed, outcome: "success" });
        if (rand() < Math.min(0.95, xG / (0.35 + xG * 0.6))) {
          const assister = pick(onPitch[side].filter((p) => p.position !== "GK" && p.id !== shooter.id));
          push({ minute, second, type: "goal", team: side, playerId: shooter.id, secondaryPlayerId: assister?.id, xG, x, y, speed });
          possessor = other(side);
        } else {
          push({ minute, second, type: "save", team: other(side), playerId: keeper(other(side)).id });
          if (rand() < 0.35) push({ minute, second, type: "corner", team: side });
        }
      }
    }

    // Fouls and cards
    if (rand() < 0.12) {
      const side = sideFor();
      const second = nextSec();
      const offender = outfield(side);
      push({ minute, second, type: "foul", team: side, playerId: offender.id, secondaryPlayerId: outfield(other(side)).id });
      const card = rand();
      if (card < 0.03) {
        push({ minute, second, type: "red_card", team: side, playerId: offender.id });
        onPitch[side] = onPitch[side].filter((p) => p.id !== offender.id);
        reds[side]++;
      } else if (card < 0.2) {
        push({ minute, second, type: "yellow_card", team: side, playerId: offender.id });
      }
    }

    // Offsides
    if (rand() < 0.04) {
      const side = sideFor();
      push({ minute, second: nextSec(), type: "offside", team: side, playerId: outfield(side, ["FWD"]).id });
    }

    // Substitutions
    if ([60, 70, 80].includes(minute)) {
      for (const side of ["home", "away"] as TeamSide[]) {
        const sub = teams[side].players.slice(11)[benchUsed[side]++];
        if (!sub) continue;
        const off = outfield(side, [sub.position]);
        push({ minute, second: nextSec(), type: "substitution", team: side, playerId: sub.id, secondaryPlayerId: off.id });
        onPitch[side] = onPitch[side].map((p) => (p.id === off.id ? sub : p));
      }
    }

    if (minute === 45) push({ minute: 45, second: 59, type: "half_time", team: "home" });
  }

  push({ minute: 90, second: 59, type: "full_time", team: "home" });
  events.sort((a, b) => a.minute - b.minute || a.second - b.second);

  return {
    id: `synthetic-${seed}`,
    competition: "Synthetic Premier Fixture",
    venue: "Northbridge Park",
    kickoff: "2026-10-24T14:00:00Z",
    home,
    away,
    events,
  };
}