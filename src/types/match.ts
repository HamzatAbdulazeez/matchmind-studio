export type TeamSide = "home" | "away";

export type EventType =
  | "kickoff" | "pass" | "tackle" | "interception" | "possession_change" | "pressure" | "sprint"
  | "shot" | "shot_on_target" | "goal" | "save"
  | "foul" | "yellow_card" | "red_card" | "corner"
  | "offside" | "substitution" | "half_time" | "full_time";

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Player {
  id: string;
  name: string;
  number: number;
  position: Position;
  workRate: number; 
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  side: TeamSide;
  players: Player[]; 
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
  distance?: number; 
  difficulty?: number; 
  speed?: number;
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
  avgPassDistance: number;
  hardPassesCompleted: number; 
  shots: number;
  shotsOnTarget: number;
  xG: number;
  maxShotSpeed: number;
  pressures: number;
  possessionWins: number;
  sprints: number;
  distanceKm: number;
  fouls: number;
  corners: number;
  yellowCards: number;
  redCards: number;
}

export interface PlayerStats {
  id: string;
  name: string;
  team: TeamSide;
  position: Position;
  number: number;
  onPitch: boolean;
  minutes: number;
  passes: number;
  passAccuracy: number;
  avgPassDistance: number;
  hardPassesCompleted: number;
  shots: number;
  xG: number;
  goals: number;
  assists: number;
  pressures: number;
  tackles: number;
  interceptions: number;
  sprints: number;
  topSpeed: number;
  distanceKm: number;
  cards: number;
}

export type KeyMomentKind =
  | "goal" | "big_chance" | "red_card" | "momentum_shift"
  | "pressure_shift" | "chaos" | "milestone";

export interface KeyMoment {
  id: string;
  minute: number;
  kind: KeyMomentKind;
  team: TeamSide;
  title: string;
  evidence: string[]; 
  eventIds: string[];
  importance: number;
  playerId?: string;
}

export interface ShotPoint {
  id: string;
  minute: number;
  team: TeamSide;
  playerId?: string;
  player: string;
  x: number;
  y: number;
  xG: number;
  speed: number;
  result: "goal" | "saved" | "on_target" | "off_target";
}

export interface MinutePoint {
  minute: number;
  momentum: number; 
  control: number; 
  tempo: number;
  pressure: Record<TeamSide, number>; 
}

export interface MatchState {
  minute: number;
  period: "pre" | "first_half" | "half_time" | "second_half" | "full_time";
  score: Score;
  stats: Record<TeamSide, TeamStats>;
  momentum: number;
  momentumSeries: number[];
  control: number;
  tempo: number;
  timeline: MinutePoint[];
  keyMoments: KeyMoment[];
  shotMap: ShotPoint[];
  players: PlayerStats[];
  recentEvents: MatchEvent[];
}