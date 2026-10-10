import type {
  EventType, KeyMoment, Match, MatchEvent, MatchState, MinutePoint, PlayerStats, ShotPoint, TeamSide, TeamStats,
} from "@/types/match";

const SIDES: TeamSide[] = ["home", "away"];
const MOMENTUM_WINDOW = 10;
const SHORT_WINDOW = 5;
const WEIGHTS: Partial<Record<EventType, number>> = { goal: 10, shot_on_target: 6, shot: 3, corner: 2 };
const ON_BALL: EventType[] = ["pass", "tackle", "interception", "shot", "shot_on_target", "foul"];

export const HARD_PASS = 0.6;
export const TOP_SPEED_TAG = 33;

export function eventWeight(e: MatchEvent): number {
  if (e.type === "pass") return e.outcome === "success" && (e.x ?? 0) > 66 ? 1 : 0; 
  if (e.type === "pressure") return (e.x ?? 0) > 66 ? 0.5 : 0;
  return WEIGHTS[e.type] ?? 0;
}

const emptyStats = (): TeamStats => ({
  possession: 50, passes: 0, passAccuracy: 0, avgPassDistance: 0, hardPassesCompleted: 0,
  shots: 0, shotsOnTarget: 0, xG: 0, maxShotSpeed: 0, pressures: 0, possessionWins: 0,
  sprints: 0, distanceKm: 0, fouls: 0, corners: 0, yellowCards: 0, redCards: 0,
});

interface Bucket {
  threat: Record<TeamSide, number>;
  pressure: Record<TeamSide, number>;
  changes: number;
  onBall: number;
  passes: number;
  completed: number;
}

const newBucket = (): Bucket => ({
  threat: { home: 0, away: 0 }, pressure: { home: 0, away: 0 }, changes: 0, onBall: 0, passes: 0, completed: 0,
});

const round1 = (v: number) => Math.round(v * 10) / 10;
const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);

/** Computes the full match state from the events played so far. */
export function computeState(match: Match, events: MatchEvent[]): MatchState {
  const players = new Map([...match.home.players, ...match.away.players].map((p) => [p.id, p]));
  const sideOf = new Map(SIDES.flatMap((s) => match[s].players.map((p) => [p.id, s] as const)));
  const name = (id?: string) => (id && players.get(id)?.name) || "Unknown player";
  const minute = events.at(-1)?.minute ?? 0;

  const stats = { home: emptyStats(), away: emptyStats() };
  const completed = { home: 0, away: 0 };
  const passDistance = { home: 0, away: 0 };
  const score = { home: 0, away: 0 };
  const buckets = Array.from({ length: 96 }, newBucket);
  const keyMoments: KeyMoment[] = [];
  const shotMap: ShotPoint[] = [];
  let period: MatchState["period"] = "pre";
  let lastShot: MatchEvent | undefined;

  // Player tracking
  const ps = new Map<string, PlayerStats & { passDist: number; completed: number; on: number | null; played: number }>();
  for (const side of SIDES) {
    match[side].players.forEach((p, i) => {
      ps.set(p.id, {
        id: p.id, name: p.name, team: side, position: p.position, number: p.number,
        onPitch: i < 11, minutes: 0, passes: 0, passAccuracy: 0, avgPassDistance: 0, hardPassesCompleted: 0,
        shots: 0, xG: 0, goals: 0, assists: 0, pressures: 0, tackles: 0, interceptions: 0,
        sprints: 0, topSpeed: 0, distanceKm: 0, cards: 0,
        passDist: 0, completed: 0, on: i < 11 ? 0 : null, played: 0,
      });
    });
  }
  const leave = (id: string | undefined, at: number) => {
    const p = id ? ps.get(id) : undefined;
    if (p?.on != null) { p.played += at - p.on; p.on = null; p.onPitch = false; }
  };

  // Milestone trackers
  const firstOnTarget = { home: false, away: false };
  const nextPassMilestone = { home: 100, away: 100 };
  let matchTopSpeed = 0;

  const moment = (m: Omit<KeyMoment, "eventIds"> & { eventIds?: string[] }) =>
    keyMoments.push({ eventIds: [], ...m });

  for (const e of events) {
    const s = stats[e.team];
    const b = buckets[Math.min(e.minute, 95)];
    b.threat[e.team] += eventWeight(e);
    if (ON_BALL.includes(e.type)) b.onBall++;
    const p = e.playerId ? ps.get(e.playerId) : undefined;

    switch (e.type) {
      case "kickoff":
        period = e.minute < 45 ? "first_half" : "second_half";
        break;
      case "half_time":
        period = "half_time";
        break;
      case "full_time":
        period = "full_time";
        break;

      case "pass": {
        s.passes++;
        b.passes++;
        passDistance[e.team] += e.distance ?? 0;
        if (p) { p.passes++; p.passDist += e.distance ?? 0; }
        if (e.outcome === "success") {
          completed[e.team]++;
          b.completed++;
          if (p) p.completed++;
          if ((e.difficulty ?? 0) >= HARD_PASS) {
            s.hardPassesCompleted++;
            if (p) p.hardPassesCompleted++;
          }
          if (completed[e.team] === nextPassMilestone[e.team]) {
            moment({
              id: `km-ms-pass-${e.team}-${nextPassMilestone[e.team]}`, minute: e.minute, kind: "milestone", team: e.team,
              title: `${match[e.team].name} complete their ${nextPassMilestone[e.team]}th pass`,
              evidence: [
                `Pass accuracy so far: ${Math.round((completed[e.team] / s.passes) * 100)}%`,
                `${s.hardPassesCompleted} of those were hard passes (difficulty ${HARD_PASS}+)`,
              ],
              eventIds: [e.id], importance: 3,
            });
            nextPassMilestone[e.team] += 100;
          }
          if (p && p.completed === 50) {
            moment({
              id: `km-ms-p50-${p.id}`, minute: e.minute, kind: "milestone", team: e.team, playerId: p.id,
              title: `${p.name} completes 50 passes`,
              evidence: [`${Math.round((p.completed / p.passes) * 100)}% accuracy`, `Average pass length ${Math.round(p.passDist / p.passes)} m`],
              eventIds: [e.id], importance: 3,
            });
          }
        }
        break;
      }

      case "pressure":
        s.pressures++;
        b.pressure[e.team]++;
        if (p) p.pressures++;
        break;

      case "possession_change":
        s.possessionWins++;
        b.changes++;
        break;

      case "tackle":
        if (p) p.tackles++;
        break;
      case "interception":
        if (p) p.interceptions++;
        break;

      case "sprint": {
        s.sprints++;
        const speed = e.speed ?? 0;
        if (p) { p.sprints++; p.topSpeed = Math.max(p.topSpeed, speed); }
        if (speed >= TOP_SPEED_TAG && speed > matchTopSpeed) {
          moment({
            id: `km-ms-speed-${e.id}`, minute: e.minute, kind: "milestone", team: e.team, playerId: e.playerId,
            title: `Fastest sprint of the match: ${name(e.playerId)}, ${speed} km/h`,
            evidence: [
              matchTopSpeed ? `Beats the previous best of ${matchTopSpeed} km/h` : "First sprint above 33 km/h in the match",
              `Sprints are runs above 25 km/h`,
            ],
            eventIds: [e.id], importance: 4,
          });
        }
        matchTopSpeed = Math.max(matchTopSpeed, speed);
        break;
      }

      case "shot":
      case "shot_on_target":
        s.shots++;
        s.xG += e.xG ?? 0;
        s.maxShotSpeed = Math.max(s.maxShotSpeed, e.speed ?? 0);
        if (p) { p.shots++; p.xG += e.xG ?? 0; }
        lastShot = e;
        shotMap.push({
          id: e.id, minute: e.minute, team: e.team, playerId: e.playerId, player: name(e.playerId),
          x: e.x ?? 85, y: e.y ?? 50, xG: e.xG ?? 0, speed: e.speed ?? 0,
          result: e.type === "shot" ? "off_target" : "on_target",
        });
        if (e.type === "shot_on_target") {
          s.shotsOnTarget++;
          if (!firstOnTarget[e.team]) {
            firstOnTarget[e.team] = true;
            moment({
              id: `km-ms-first-${e.team}`, minute: e.minute, kind: "milestone", team: e.team, playerId: e.playerId,
              title: `${match[e.team].name}'s first shot on target`,
              evidence: [`${name(e.playerId)}, chance quality (xG) ${e.xG}`, `Struck at ${e.speed} km/h`, `Their ${s.shots}${s.shots === 1 ? "st" : s.shots === 2 ? "nd" : s.shots === 3 ? "rd" : "th"} shot of the match`],
              eventIds: [e.id], importance: 3,
            });
          }
        }
        if (e.type === "shot" && (e.xG ?? 0) >= 0.3) {
          moment({
            id: `km-${e.id}`, minute: e.minute, kind: "big_chance", team: e.team, playerId: e.playerId,
            title: `Big chance missed by ${name(e.playerId)}`,
            evidence: [`Chance quality (xG): ${e.xG}, normally scored ${Math.round((e.xG ?? 0) * 100)}% of the time`, "Shot went off target"],
            eventIds: [e.id], importance: 6,
          });
        }
        break;

      case "save": {
        const saved = shotMap.find((sp) => sp.id === lastShot?.id);
        if (saved) saved.result = "saved";
        if (lastShot && (lastShot.xG ?? 0) >= 0.3) {
          moment({
            id: `km-${e.id}`, minute: e.minute, kind: "big_chance", team: e.team, playerId: e.playerId,
            title: `Big save by ${name(e.playerId)}`,
            evidence: [`Denied ${name(lastShot.playerId)} from a ${lastShot.xG} xG chance`, `Shot speed ${lastShot.speed} km/h`],
            eventIds: [lastShot.id, e.id], importance: 6,
          });
        }
        break;
      }

      case "goal": {
        score[e.team]++;
        const scored = shotMap.find((sp) => sp.id === lastShot?.id);
        if (scored) scored.result = "goal";
        if (p) p.goals++;
        const assister = e.secondaryPlayerId ? ps.get(e.secondaryPlayerId) : undefined;
        if (assister) assister.assists++;
        const xg = lastShot?.xG ?? e.xG ?? 0;
        moment({
          id: `km-${e.id}`, minute: e.minute, kind: "goal", team: e.team, playerId: e.playerId,
          title: `GOAL: ${name(e.playerId)} (${match[e.team].shortName})`,
          evidence: [
            `Score: ${match.home.shortName} ${score.home}–${score.away} ${match.away.shortName}`,
            `Chance quality (xG): ${xg}${xg < 0.15 ? ", a low-probability finish" : ""}`,
            `Shot speed: ${e.speed ?? lastShot?.speed ?? "n/a"} km/h`,
            e.secondaryPlayerId ? `Assist: ${name(e.secondaryPlayerId)}` : "Unassisted",
          ],
          eventIds: lastShot ? [lastShot.id, e.id] : [e.id], importance: 10,
        });
        if (p && p.goals === 2) {
          moment({
            id: `km-ms-brace-${p.id}`, minute: e.minute, kind: "milestone", team: e.team, playerId: p.id,
            title: `${p.name} scores twice`,
            evidence: [`${p.goals} goals from ${p.shots} shots`, `Total xG ${round1(p.xG)}`],
            eventIds: [e.id], importance: 5,
          });
        }
        break;
      }

      case "foul":
        s.fouls++;
        break;
      case "corner":
        s.corners++;
        break;
      case "yellow_card":
        s.yellowCards++;
        if (p) p.cards++;
        break;
      case "red_card":
        s.redCards++;
        if (p) p.cards++;
        leave(e.playerId, e.minute);
        moment({
          id: `km-${e.id}`, minute: e.minute, kind: "red_card", team: e.team, playerId: e.playerId,
          title: `Red card: ${name(e.playerId)}`,
          evidence: [`${match[e.team].name} down to ${11 - s.redCards} players`],
          eventIds: [e.id], importance: 8,
        });
        break;
      case "substitution": {
        leave(e.secondaryPlayerId, e.minute);
        const sub = p;
        if (sub) { sub.on = e.minute; sub.onPitch = true; }
        break;
      }
    }
  }

  // Team ratios
  const totalPasses = stats.home.passes + stats.away.passes;
  for (const side of SIDES) {
    const s = stats[side];
    s.passAccuracy = s.passes ? Math.round((completed[side] / s.passes) * 100) : 0;
    s.avgPassDistance = s.passes ? Math.round(passDistance[side] / s.passes) : 0;
    s.xG = Math.round(s.xG * 100) / 100;
  }
  if (totalPasses) {
    stats.home.possession = Math.round((stats.home.passes / totalPasses) * 100);
    stats.away.possession = 100 - stats.home.possession;
  }

  // Player totals (distance = work rate x minutes played + extra for each sprint)
  const playerStats: PlayerStats[] = [];
  for (const p of ps.values()) {
    const minutes = p.played + (p.on != null ? Math.max(0, minute - p.on) : 0);
    const base = players.get(p.id)!;
    const { passDist, completed: done, on, played, ...rest } = p;
    void on; void played;
    const out: PlayerStats = {
      ...rest,
      minutes,
      passAccuracy: p.passes ? Math.round((done / p.passes) * 100) : 0,
      avgPassDistance: p.passes ? Math.round(passDist / p.passes) : 0,
      xG: Math.round(p.xG * 100) / 100,
      distanceKm: round1((base.workRate * minutes + p.sprints * 30) / 1000),
    };
    playerStats.push(out);
    stats[sideOf.get(p.id)!].distanceKm += out.distanceKm;
  }
  for (const side of SIDES) stats[side].distanceKm = round1(stats[side].distanceKm);

  // Per-minute timeline: momentum, control vs chaos, tempo, pressure
  const momentumSeries: number[] = [];
  const timeline: MinutePoint[] = [];
  let dominant: TeamSide | null = null;
  let chaosArmed = true;
  const lastPressureFlag: Record<TeamSide, number> = { home: -99, away: -99 };

  const windowSum = (m: number, len: number, f: (b: Bucket) => number) => {
    let t = 0;
    for (let k = Math.max(0, m - len + 1); k <= m; k++) t += f(buckets[k]);
    return t;
  };

  for (let m = 1; m <= minute; m++) {
    const diff = windowSum(m, MOMENTUM_WINDOW, (b) => b.threat.home - b.threat.away);
    const momentum = Math.round(100 * Math.tanh(diff / 15));
    momentumSeries.push(momentum);

    const len = Math.min(SHORT_WINDOW, m);
    const changes = windowSum(m, SHORT_WINDOW, (b) => b.changes);
    const passesW = windowSum(m, SHORT_WINDOW, (b) => b.passes);
    const doneW = windowSum(m, SHORT_WINDOW, (b) => b.completed);
    const completion = passesW ? doneW / passesW : 0.8;
    const changeRate = changes / len;
    const control = Math.round(Math.min(100, Math.max(0, 100 * (0.6 * (1 - changeRate / 4) + 0.4 * ((completion - 0.55) / 0.4)))));
    const tempo = round1(windowSum(m, SHORT_WINDOW, (b) => b.onBall) / len);
    const pressure = {
      home: windowSum(m, SHORT_WINDOW, (b) => b.pressure.home),
      away: windowSum(m, SHORT_WINDOW, (b) => b.pressure.away),
    };
    timeline.push({ minute: m, momentum, control, tempo, pressure });

    // Momentum swings
    if (Math.abs(momentum) >= 45) {
      const side: TeamSide = momentum > 0 ? "home" : "away";
      if (dominant && dominant !== side) {
        moment({
          id: `km-mom-${m}`, minute: m, kind: "momentum_shift", team: side,
          title: `Momentum swings to ${match[side].name}`,
          evidence: [
            `Momentum index now ${sign(momentum)} (−100 to +100, positive = ${match.home.shortName})`,
            `Based on shots, corners, final-third passes and high pressing over the last ${MOMENTUM_WINDOW} minutes`,
            `${match[side].shortName} pressures in the last 5 minutes: ${pressure[side]}`,
          ],
          importance: 5,
        });
      }
      dominant = side;
    }

    // Control vs chaos: the game breaks up
    if (m >= 8) {
      if (chaosArmed && control < 38) {
        const leader: TeamSide = pressure.home >= pressure.away ? "home" : "away";
        moment({
          id: `km-chaos-${m}`, minute: m, kind: "chaos", team: leader,
          title: "The game turns chaotic",
          evidence: [
            `Control index ${control}/100 (100 = calm, controlled possession)`,
            `${changes} possession changes in the last ${len} minutes`,
            `Pass completion in that spell: ${Math.round(completion * 100)}%`,
            `${match[leader].shortName} are pressing hardest: ${pressure[leader]} pressures in 5 minutes`,
          ],
          importance: 4,
        });
        chaosArmed = false;
      } else if (control > 58) {
        chaosArmed = true;
      }
    }

    // Pressing phases
    for (const side of SIDES) {
      const opp: TeamSide = side === "home" ? "away" : "home";
      if (m >= 6 && pressure[side] >= 11 && pressure[side] >= pressure[opp] * 1.8 && m - lastPressureFlag[side] >= 15) {
        moment({
          id: `km-press-${side}-${m}`, minute: m, kind: "pressure_shift", team: side,
          title: `${match[side].name} turn up the press`,
          evidence: [
            `${pressure[side]} pressures in the last 5 minutes, against ${pressure[opp]} from ${match[opp].shortName}`,
            `${windowSum(m, SHORT_WINDOW, (b) => b.changes)} possession changes in that spell`,
            `${match[opp].shortName} are being forced into riskier passes`,
          ],
          importance: 4,
        });
        lastPressureFlag[side] = m;
      }
    }
  }

  keyMoments.sort((a, b) => a.minute - b.minute);
  const last = timeline.at(-1);

  return {
    minute,
    period,
    score,
    stats,
    momentum: momentumSeries.at(-1) ?? 0,
    momentumSeries,
    control: last?.control ?? 70,
    tempo: last?.tempo ?? 0,
    timeline,
    keyMoments,
    shotMap,
    players: playerStats,
    recentEvents: events
      .filter((e) => isLoggable(e))
      .slice(-20)
      .reverse(),
  };
}

/** Events worth showing in the human-readable log. */
export function isLoggable(e: MatchEvent): boolean {
  if (["pass", "tackle", "interception", "pressure", "possession_change"].includes(e.type)) return false;
  if (e.type === "sprint") return (e.speed ?? 0) >= TOP_SPEED_TAG;
  return true;
}