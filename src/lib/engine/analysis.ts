import type { EventType, KeyMoment, Match, MatchEvent, MatchState, ShotPoint, TeamSide, TeamStats } from "@/types/match";

const SIDES: TeamSide[] = ["home", "away"];
const MOMENTUM_WINDOW = 10; // minutes
const WEIGHTS: Partial<Record<EventType, number>> = { goal: 10, shot_on_target: 6, shot: 3, corner: 2 };

export function eventWeight(e: MatchEvent): number {
  if (e.type === "pass") return e.outcome === "success" && (e.x ?? 0) > 66 ? 1 : 0; 
  return WEIGHTS[e.type] ?? 0;
}

const emptyStats = (): TeamStats => ({
  possession: 50, passes: 0, passAccuracy: 0, shots: 0, shotsOnTarget: 0,
  xG: 0, fouls: 0, corners: 0, yellowCards: 0, redCards: 0,
});

/** Computes the full match state from the events played so far. */
export function computeState(match: Match, events: MatchEvent[]): MatchState {
  const players = new Map([...match.home.players, ...match.away.players].map((p) => [p.id, p]));
  const name = (id?: string) => (id && players.get(id)?.name) || "Unknown player";

  const stats = { home: emptyStats(), away: emptyStats() };
  const completed = { home: 0, away: 0 };
  const score = { home: 0, away: 0 };
  const buckets = Array.from({ length: 96 }, () => ({ home: 0, away: 0 }));
  const keyMoments: KeyMoment[] = [];
  const shotMap: ShotPoint[] = [];
  let period: MatchState["period"] = "pre";
  let lastShot: MatchEvent | undefined;

  for (const e of events) {
    const s = stats[e.team];
    buckets[Math.min(e.minute, 95)][e.team] += eventWeight(e);

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
      case "pass":
        s.passes++;
        if (e.outcome === "success") completed[e.team]++;
        break;
      case "shot":
      case "shot_on_target":
        s.shots++;
        s.xG += e.xG ?? 0;
        if (e.type === "shot_on_target") s.shotsOnTarget++;
        lastShot = e;
        shotMap.push({
          id: e.id, minute: e.minute, team: e.team, player: name(e.playerId),
          x: e.x ?? 85, y: e.y ?? 50, xG: e.xG ?? 0,
          result: e.type === "shot" ? "off_target" : "on_target",
        });
        if (e.type === "shot" && (e.xG ?? 0) >= 0.3) {
          keyMoments.push({
            id: `km-${e.id}`, minute: e.minute, kind: "big_chance", team: e.team,
            title: `Big chance missed by ${name(e.playerId)}`,
            evidence: [`Chance quality (xG): ${e.xG} — normally scored ${Math.round((e.xG ?? 0) * 100)}% of the time`, "Shot went off target"],
            eventIds: [e.id], importance: 6,
          });
        }
        break;
      case "save": {
        const saved = shotMap.find((sp) => sp.id === lastShot?.id);
        if (saved) saved.result = "saved";
        if (lastShot && (lastShot.xG ?? 0) >= 0.3) {
          keyMoments.push({
            id: `km-${e.id}`, minute: e.minute, kind: "big_chance", team: e.team,
            title: `Big save by ${name(e.playerId)}`,
            evidence: [`Denied ${name(lastShot.playerId)} from a ${lastShot.xG} xG chance`],
            eventIds: [lastShot.id, e.id], importance: 6,
          });
        }
        break;
      }
      case "goal": {
        score[e.team]++;
        const scored = shotMap.find((sp) => sp.id === lastShot?.id);
        if (scored) scored.result = "goal";
        const xg = lastShot?.xG ?? e.xG ?? 0;
        keyMoments.push({
          id: `km-${e.id}`, minute: e.minute, kind: "goal", team: e.team,
          title: `GOAL — ${name(e.playerId)} (${match[e.team].shortName})`,
          evidence: [
            `Score: ${match.home.shortName} ${score.home}–${score.away} ${match.away.shortName}`,
            `Chance quality (xG): ${xg}${xg < 0.15 ? " — a low-probability finish" : ""}`,
            e.secondaryPlayerId ? `Assist: ${name(e.secondaryPlayerId)}` : "Unassisted",
          ],
          eventIds: lastShot ? [lastShot.id, e.id] : [e.id], importance: 10,
        });
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
        break;
      case "red_card":
        s.redCards++;
        keyMoments.push({
          id: `km-${e.id}`, minute: e.minute, kind: "red_card", team: e.team,
          title: `Red card — ${name(e.playerId)}`,
          evidence: [`${match[e.team].name} down to ${11 - s.redCards} players`],
          eventIds: [e.id], importance: 8,
        });
        break;
    }
  }

  // Possession (pass share) and pass accuracy
  const totalPasses = stats.home.passes + stats.away.passes;
  for (const side of SIDES) {
    const s = stats[side];
    s.passAccuracy = s.passes ? Math.round((completed[side] / s.passes) * 100) : 0;
    s.xG = Math.round(s.xG * 100) / 100;
  }
  if (totalPasses) {
    stats.home.possession = Math.round((stats.home.passes / totalPasses) * 100);
    stats.away.possession = 100 - stats.home.possession;
  }

  // Momentum: rolling weighted threat over the last 10 minutes
  const minute = events.at(-1)?.minute ?? 0;
  const momentumSeries: number[] = [];
  let dominant: TeamSide | null = null;

  for (let m = 1; m <= minute; m++) {
    let diff = 0;
    for (let k = Math.max(0, m - MOMENTUM_WINDOW + 1); k <= m; k++) diff += buckets[k].home - buckets[k].away;
    const value = Math.round(100 * Math.tanh(diff / 15));
    momentumSeries.push(value);

    if (Math.abs(value) >= 45) {
      const side: TeamSide = value > 0 ? "home" : "away";
      if (dominant && dominant !== side) {
        keyMoments.push({
          id: `km-mom-${m}`, minute: m, kind: "momentum_shift", team: side,
          title: `Momentum swings to ${match[side].name}`,
          evidence: [
            `Momentum index now ${value > 0 ? "+" : ""}${value} (−100 to +100, positive = ${match.home.shortName})`,
            `Based on shots, corners and final-third passes over the last ${MOMENTUM_WINDOW} minutes`,
          ],
          eventIds: [], importance: 5,
        });
      }
      dominant = side;
    }
  }

  keyMoments.sort((a, b) => a.minute - b.minute);

  return {
    minute,
    period,
    score,
    stats,
    momentum: momentumSeries.at(-1) ?? 0,
    momentumSeries,
    keyMoments,
    shotMap,
    recentEvents: events
      .filter((e) => !["pass", "tackle", "interception"].includes(e.type))
      .slice(-20)
      .reverse(),
  };
}