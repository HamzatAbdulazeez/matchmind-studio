export type TeamSide = "home" | "away";

export type EventType =
  | "kickoff" | "pass" | "tackle" | "interception"
  | "shot" | "shot_on_target" | "goal" | "save"
  | "foul" | "yellow_card" | "red_card" | "corner"
  | "offside" | "substitution" | "half_time" | "full_time";

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Player {
  id: string;
  name: string;
  number: number;
  position: Position;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  side: TeamSide;
  players: Player[]; // first 11 = starters, rest = bench
}

export interface MatchEvent {
  id: string;
  minute: number;
  second: number;
  type: EventType;
  team: TeamSide;
  playerId?: string;
  secondaryPlayerId?: string; 
  x?: number; 
  y?: number; 
  xG?: number;
  outcome?: "success" | "fail";
}

export interface Match {
  id: string;
  competition: string;
  venue: string;
  kickoff: string;
  home: Team;
  away: Team;
  events: MatchEvent[];
}

export type MatchMeta = Omit<Match, "events">;

export interface Score {
  home: number;
  away: number;
}

export interface TeamStats {
  possession: number;
  passes: number;
  passAccuracy: number;
  shots: number;
  shotsOnTarget: number;
  xG: number;
  fouls: number;
  corners: number;
  yellowCards: number;
  redCards: number;
}

export type KeyMomentKind = "goal" | "big_chance" | "red_card" | "momentum_shift";

export interface KeyMoment {
  id: string;
  minute: number;
  kind: KeyMomentKind;
  team: TeamSide;
  title: string;
  evidence: string[]; 
  eventIds: string[];
  importance: number; 
}

export interface ShotPoint {
  id: string;
  minute: number;
  team: TeamSide;
  player: string;
  x: number;
  y: number;
  xG: number;
  result: "goal" | "saved" | "on_target" | "off_target";
}

export interface MatchState {
  minute: number;
  period: "pre" | "first_half" | "half_time" | "second_half" | "full_time";
  score: Score;
  stats: Record<TeamSide, TeamStats>;
  momentum: number; 
  momentumSeries: number[];
  keyMoments: KeyMoment[];
  shotMap: ShotPoint[];
  recentEvents: MatchEvent[];
}