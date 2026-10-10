"use client";

import type { MatchEvent, MatchMeta, MatchState, PlayerStats, TeamSide } from "@/types/match";
import type { StatsSnapshot } from "@/hooks/useMatchStream";
import type { OverlayCue } from "@/lib/overlay/cues";
import { describeEvent } from "@/lib/engine/describe";
import {
  METRICS, VIEW_MODES, controlLabel, momentumWords,
  type MetricKey, type ViewMode, type ViewerProfile,
} from "@/lib/personalize";
import { PitchView } from "./pitch";
import { MomentIcon, Panel, SegmentedControl, StatTile, TEAM_BG, TEAM_TEXT, selectClass } from "./ui";

const SIDES: TeamSide[] = ["home", "away"];


export function ProfileBar({
  meta,
  profile,
  onChange,
  live,
}: {
  meta: MatchMeta | null;
  profile: ViewerProfile;
  onChange: (p: ViewerProfile) => void;
  live: boolean;
}) {
  const set = (patch: Partial<ViewerProfile>) => onChange({ ...profile, ...patch });
  const players = meta ? SIDES.flatMap((side) => meta[side].players.map((p) => ({ ...p, side }))) : [];

  return (
    <section aria-label="Viewing profile" className="rounded-lg border border-rail bg-deck p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-display text-lg font-semibold tracking-wide">Watch as</p>
        <SegmentedControl
          label="Viewing mode"
          value={profile.mode}
          onChange={(mode: ViewMode) => set({ mode, playerId: mode === "player" ? profile.playerId ?? players.find((p) => p.position === "FWD")?.id : profile.playerId })}
          options={(Object.keys(VIEW_MODES) as ViewMode[]).map((m) => ({ value: m, label: VIEW_MODES[m].label }))}
        />
        <select
          aria-label="Favourite club"
          value={profile.team ?? ""}
          onChange={(e) => set({ team: (e.target.value || undefined) as TeamSide | undefined })}
          className={selectClass}
        >
          <option value="">No favourite club</option>
          {meta && SIDES.map((s) => <option key={s} value={s}>★ {meta[s].name}</option>)}
        </select>
        {profile.mode === "player" && meta && (
          <select aria-label="Focus player" value={profile.playerId ?? ""} onChange={(e) => set({ playerId: e.target.value })} className={selectClass}>
            {SIDES.map((side) => (
              <optgroup key={side} label={meta[side].name}>
                {meta[side].players.map((p) => (
                  <option key={p.id} value={p.id}>#{p.number} {p.name} ({p.position}){p.number > 11 ? ", bench" : ""}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        {profile.mode === "metric" && (
          <select aria-label="Focus metric" value={profile.metric} onChange={(e) => set({ metric: e.target.value as MetricKey })} className={selectClass}>
            {(Object.keys(METRICS) as MetricKey[]).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
          </select>
        )}
      </div>
      <p className="mt-2 text-sm text-mist">
        {VIEW_MODES[profile.mode].blurb}
        {live && " Commentary keeps the profile you went live with; replay the match to hear it in the new style."}
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- Casual: the story */

function whatToWatch(meta: MatchMeta, state: MatchState): string {
  if (state.period === "full_time") return "That's full-time. Write a recap below to share the story of the match.";
  if (state.period === "half_time") return "It's half-time. Watch whether the team on top keeps it going after the break.";
  const { home, away } = state.stats;
  const p5 = state.timeline.at(-1)?.pressure ?? { home: 0, away: 0 };
  const pressLeader: TeamSide = p5.home >= p5.away ? "home" : "away";
  const xgLeader: TeamSide = home.xG >= away.xG ? "home" : "away";
  const other: TeamSide = xgLeader === "home" ? "away" : "home";
  if (state.stats[xgLeader].xG - state.stats[other].xG >= 0.6 && state.score[xgLeader] <= state.score[other]) {
    return `${meta[xgLeader].name} have created the better chances but aren't ahead. If they keep this up, a goal could be coming.`;
  }
  if (p5[pressLeader] >= 9) {
    const opponent = meta[pressLeader === "home" ? "away" : "home"].name;
    const onTop = state.momentum > 0 ? "home" : "away";
    return Math.abs(state.momentum) >= 20 && onTop !== pressLeader
      ? `${meta[pressLeader].name} are pressing hard to win the ball back. If they force a mistake from ${opponent}, the game could turn.`
      : `${meta[pressLeader].name} are hunting the ball high up the pitch. Watch for mistakes from ${opponent}.`;
  }
  if (state.control < 40) return "The game is end-to-end and scrappy right now. Anything could happen.";
  return "The game has settled. Watch who wins the next big chance.";
}

function resultWords(state: MatchState, names: Record<TeamSide, string>): string {
  const { home, away } = state.score;
  if (home === away) return `${names.home} and ${names.away} share the points.`;
  const winner: TeamSide = home > away ? "home" : "away";
  return `${names[winner]} win it.`;
}

export function StoryCard({ meta, state }: { meta: MatchMeta; state: MatchState }) {
  const names = { home: meta.home.name, away: meta.away.name };
  const latest = [...state.keyMoments].reverse().find((k) => k.kind !== "milestone");
  const fastest = [...state.players].sort((a, b) => b.topSpeed - a.topSpeed)[0];
  return (
    <Panel title="The story so far">
      <p className="font-display text-3xl font-bold leading-tight">
        {state.period === "full_time" ? resultWords(state, names) : momentumWords(state, names)}
      </p>
      <p className="mt-2 text-lg leading-snug text-chalk/90">
        {state.period === "full_time" ? (
          <>It finished {state.score.home}–{state.score.away}, and the closing stages felt{" "}</>
        ) : (
          <>It&apos;s {state.score.home}–{state.score.away} after {state.minute} minutes, and the game feels{" "}</>
        )}
        <span className="font-semibold text-gold">{controlLabel(state.control)}</span>.
      </p>
      {latest && (
        <div className="mt-4 flex items-start gap-3 rounded-md bg-night/60 p-3">
          <MomentIcon kind={latest.kind} className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-relaxed">
            <span className="font-display font-semibold tabular-nums text-mist">{latest.minute}&apos; </span>
            {latest.title}
          </p>
        </div>
      )}
      <div className="mt-4 rounded-md border-l-4 border-gold bg-night/60 p-3">
        <p className="font-display text-sm font-semibold tracking-wide text-gold">WHAT TO WATCH</p>
        <p className="mt-1 text-sm leading-relaxed">{whatToWatch(meta, state)}</p>
      </div>
      {fastest && fastest.topSpeed > 0 && (
        <p className="mt-3 text-sm text-mist">
          Fastest player so far: <span className="text-chalk">{fastest.name}</span> at {fastest.topSpeed} km/h.
        </p>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- Analyst: control vs chaos */

function Strip({ values, max, min = 0, color, band, height = 56 }: { values: number[]; max: number; min?: number; color: string; band?: [number, number]; height?: number }) {
  const y = (v: number) => 40 - ((v - min) / (max - min || 1)) * 40;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${i + 0.5},${y(v)}`).join(" ");
  return (
    <svg viewBox="0 0 90 40" preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden="true">
      {band && <rect x="0" y={y(band[1])} width="90" height={y(band[0]) - y(band[1])} fill="var(--color-tally)" fillOpacity="0.12" />}
      <line x1="45" x2="45" y1="0" y2="40" stroke="var(--color-mist)" strokeOpacity="0.3" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function ControlChaosPanel({ meta, state }: { meta: MatchMeta; state: MatchState }) {
  const t = state.timeline;
  const now = t.at(-1);
  return (
    <Panel
      title="Control, rhythm and pressure"
      action={<p className="text-xs text-mist">Rolling 5-minute windows</p>}
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span>Control vs chaos</span>
            <span className="font-display text-lg font-bold tabular-nums">
              {state.control}<span className="text-sm text-mist">/100 · {controlLabel(state.control)}</span>
            </span>
          </div>
          <Strip values={t.map((p) => p.control)} max={100} color="var(--color-gold)" band={[0, 38]} />
          <p className="text-xs text-mist">Built from possession changes and pass completion. The red band is chaos (below 38).</p>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span>Tempo</span>
            <span className="font-display text-lg font-bold tabular-nums">{state.tempo}<span className="text-sm text-mist"> on-ball events / min</span></span>
          </div>
          <Strip values={t.map((p) => p.tempo)} min={4} max={16} color="var(--color-chalk)" height={44} />
        </div>
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span>Pressing</span>
            <span className="font-display text-lg font-bold tabular-nums">
              <span className={TEAM_TEXT.home}>{now?.pressure.home ?? 0}</span>
              <span className="mx-1.5 text-mist">v</span>
              <span className={TEAM_TEXT.away}>{now?.pressure.away ?? 0}</span>
              <span className="text-sm text-mist"> last 5 min</span>
            </span>
          </div>
          <svg viewBox="0 0 90 40" preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
            {t.map((p, i) => {
              const h = Math.min(p.pressure.home, 20);
              const a = Math.min(p.pressure.away, 20);
              return (
                <g key={p.minute}>
                  <rect x={i + 0.1} y={20 - h} width="0.8" height={h} fill="var(--color-home)" fillOpacity="0.8" />
                  <rect x={i + 0.1} y={20} width="0.8" height={a} fill="var(--color-away)" fillOpacity="0.8" />
                </g>
              );
            })}
          </svg>
          <div className="flex justify-between text-xs text-mist">
            <span className={TEAM_TEXT.home}>{meta.home.shortName} pressing up</span>
            <span className={TEAM_TEXT.away}>{meta.away.shortName} pressing down</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Analyst: player tracking table */

const PLAYER_COLUMNS: [keyof PlayerStats, string][] = [
  ["minutes", "Min"],
  ["passes", "Passes"],
  ["passAccuracy", "Acc %"],
  ["avgPassDistance", "Avg m"],
  ["hardPassesCompleted", "Hard"],
  ["xG", "xG"],
  ["goals", "G"],
  ["pressures", "Press"],
  ["sprints", "Sprints"],
  ["topSpeed", "Top km/h"],
  ["distanceKm", "Km"],
];

export function PlayerTable({ meta, players, sortKey, onSort }: { meta: MatchMeta; players: PlayerStats[]; sortKey: keyof PlayerStats; onSort: (k: keyof PlayerStats) => void }) {
  const rows = players.filter((p) => p.minutes > 0).sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]));
  return (
    <Panel title="Player tracking" action={<p className="text-xs text-mist">Click a column to sort</p>}>
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="sticky top-0 bg-deck">
            <tr className="text-left text-xs text-mist">
              <th className="py-2 pr-3 font-medium">Player</th>
              {PLAYER_COLUMNS.map(([k, label]) => (
                <th key={k} className="px-1.5 py-2 text-right font-medium">
                  <button onClick={() => onSort(k)} aria-pressed={sortKey === k} className={sortKey === k ? "font-semibold text-gold" : "hover:text-chalk"}>
                    {label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rail/50">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5 pr-3">
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${TEAM_BG[p.team]}`} />
                  {p.name}
                  <span className="ml-1.5 text-xs text-mist">{meta[p.team].shortName} · {p.position}{p.onPitch ? "" : " · off"}</span>
                </td>
                {PLAYER_COLUMNS.map(([k]) => (
                  <td key={k} className={`px-1.5 py-1.5 text-right tabular-nums ${sortKey === k ? "font-semibold" : "text-chalk/85"}`}>{String(p[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-mist">Distance and speed come from the synthetic tracking model. Hard passes are completed passes with difficulty 0.6 or more.</p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Player focus */

const FOCUS_TYPES = new Set(["pass", "shot", "shot_on_target", "goal", "tackle", "interception", "pressure", "sprint", "foul", "yellow_card", "red_card", "substitution", "save"]);

export function PlayerFocusPanel({ meta, state, events, playerId }: { meta: MatchMeta; state: MatchState; events: MatchEvent[]; playerId?: string }) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) {
    return <Panel title="Player focus"><p className="text-sm text-mist">Pick a player in the bar above to follow them all match.</p></Panel>;
  }
  const involvement = events
    .filter((e) => (e.playerId === p.id || e.secondaryPlayerId === p.id) && FOCUS_TYPES.has(e.type))
    .filter((e) => e.type !== "pass" || e.playerId === p.id)
    .slice(-14)
    .reverse();
  const shots = state.shotMap.filter((s) => s.playerId === p.id);
  const rank = (k: keyof PlayerStats) => {
    const sorted = state.players.filter((x) => x.minutes > 0).sort((a, b) => Number(b[k]) - Number(a[k]));
    const i = sorted.findIndex((x) => x.id === p.id);
    return i >= 0 && i < 3 ? `#${i + 1} in the match` : undefined;
  };

  return (
    <Panel title="Player focus">
      <div className="flex items-center gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold text-night ${TEAM_BG[p.team]}`}>{p.number}</span>
        <div className="min-w-0">
          <p className="truncate font-display text-3xl font-bold leading-tight">{p.name}</p>
          <p className="text-sm text-mist">
            {meta[p.team].name} · {p.position} · {p.onPitch ? `on the pitch, ${p.minutes} min` : p.minutes ? `off after ${p.minutes} min` : "on the bench"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Passes" value={p.passes} sub={`${p.passAccuracy}% accurate`} />
        <StatTile label="Average pass" value={`${p.avgPassDistance} m`} sub={`${p.hardPassesCompleted} hard passes`} />
        <StatTile label="Shots · xG" value={`${p.shots} · ${p.xG}`} sub={`${p.goals} goals, ${p.assists} assists`} accent={p.goals ? "text-gold" : undefined} />
        <StatTile label="Pressures" value={p.pressures} sub={rank("pressures") ?? `${p.tackles} tackles, ${p.interceptions} int.`} />
        <StatTile label="Top speed" value={`${p.topSpeed || "–"} km/h`} sub={rank("topSpeed") ?? `${p.sprints} sprints`} />
        <StatTile label="Distance" value={`${p.distanceKm} km`} sub={rank("distanceKm")} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="mb-2 font-display text-base font-semibold">Every touch that mattered</p>
          {involvement.length === 0 ? (
            <p className="text-sm text-mist">Nothing yet. Their involvement appears here as it happens.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-rail/50 overflow-y-auto pr-1">
              {involvement.map((e) => (
                <li key={e.id} className="flex gap-3 py-1.5 text-sm">
                  <span className="w-8 shrink-0 font-display tabular-nums text-mist">{e.minute}&apos;</span>
                  <span className="leading-snug">
                    {describeEvent(e, meta)}
                    {e.type === "pass" && e.difficulty != null && <span className="text-mist"> · difficulty {e.difficulty}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 font-display text-base font-semibold">Their shots</p>
          <div className="rounded-md border border-rail">
            <PitchView shots={shots} meta={meta} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Metric focus */

const PLAYER_METRIC: Partial<Record<MetricKey, keyof PlayerStats>> = {
  xG: "xG", pressures: "pressures", hardPassesCompleted: "hardPassesCompleted", distanceKm: "distanceKm", sprints: "sprints", passAccuracy: "passAccuracy", possession: "passes",
};

export function MetricFocusPanel({ meta, state, history, metric }: { meta: MatchMeta; state: MatchState; history: StatsSnapshot[]; metric: MetricKey }) {
  const def = METRICS[metric];
  const h = state.stats.home[metric];
  const a = state.stats.away[metric];
  const leader: TeamSide | null = h === a ? null : h > a ? "home" : "away";
  const series = SIDES.map((side) => history.map((s) => Number(s.stats[side][metric])));
  const all = series.flat();
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const pts = (vals: number[]) =>
    vals.map((v, i) => `${(history[i].minute / 90) * 100},${40 - ((v - min) / (max - min)) * 38}`).join(" ");
  const pk = PLAYER_METRIC[metric];
  const top = pk
    ? state.players.filter((p) => p.minutes > 0 && (pk !== "passAccuracy" || p.passes >= 10)).sort((x, y) => Number(y[pk]) - Number(x[pk])).slice(0, 3)
    : [];
  const fmt = (v: number) => `${v}${def.unit}`;

  return (
    <Panel title={def.label}>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="flex items-end gap-6">
            {SIDES.map((side) => (
              <div key={side}>
                <p className={`font-display text-sm font-semibold ${TEAM_TEXT[side]}`}>{meta[side].name}</p>
                <p className="font-display text-6xl font-bold tabular-nums leading-none">{fmt(state.stats[side][metric])}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-chalk/90">{def.explain}</p>
          <p className="mt-2 text-sm text-mist">
            {leader ? `${meta[leader].name} lead on this after ${state.minute} minutes.` : "Level so far."}
          </p>
          {top.length > 0 && pk && (
            <div className="mt-4">
              <p className="font-display text-sm font-semibold tracking-wide text-mist">TOP PLAYERS</p>
              <ol className="mt-1 space-y-1 text-sm">
                {top.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="w-4 text-mist">{i + 1}</span>
                    <span className={`h-2 w-2 rounded-full ${TEAM_BG[p.team]}`} />
                    <span className="flex-1">{p.name}</span>
                    <span className="font-display font-bold tabular-nums">{String(p[pk])}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div>
          <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="h-56 w-full" aria-label={`${def.label} over time`}>
            <line x1="50" x2="50" y1="0" y2="42" stroke="var(--color-mist)" strokeOpacity="0.3" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <line x1="0" x2="100" y1="40" y2="40" stroke="var(--color-rail)" vectorEffect="non-scaling-stroke" />
            {history.length > 1 && (
              <>
                <polyline points={pts(series[0])} fill="none" stroke="var(--color-home)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <polyline points={pts(series[1])} fill="none" stroke="var(--color-away)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
          <div className="flex justify-between font-display text-xs text-mist">
            <span>0&apos;</span><span>Half-time</span><span>90&apos;</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Broadcast overlay + data feeds */

export function OverlayPanel({ cues, speed }: { cues: OverlayCue[]; speed: number }) {
  const latest = cues.slice(-4).reverse();
  return (
    <Panel title="Broadcast overlay">
      <p className="text-sm leading-relaxed text-mist">
        Every insight is also emitted as a timed, machine-readable cue (template, match clock, duration, priority, data) that a
        graphics partner can render over the live feed.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/overlay?speed=${speed}&bg=pitch`} target="_blank" rel="noreferrer" className="rounded-md bg-chalk px-3 py-1.5 text-xs font-semibold text-night hover:bg-white">
          Open overlay output
        </a>
        <a href="/api/overlay/cues" target="_blank" rel="noreferrer" className="rounded-md border border-rail px-3 py-1.5 text-xs font-semibold hover:border-chalk">
          Cue sheet (JSON)
        </a>
        <a href="/api/dataset" download className="rounded-md border border-rail px-3 py-1.5 text-xs font-semibold hover:border-chalk">
          Synthetic dataset (JSON)
        </a>
      </div>
      <p className="mt-4 font-display text-sm font-semibold tracking-wide text-mist">LATEST CUES</p>
      {latest.length === 0 ? (
        <p className="text-sm text-mist">Cues appear here during the match.</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {latest.map((c) => (
            <li key={c.id} className="rounded-sm bg-night/60 px-2 py-1.5 font-mono text-[11px] leading-snug text-chalk/85">
              {c.matchClock.minute}:{String(c.matchClock.second).padStart(2, "0")} {c.template} p{c.priority} {c.durationSec}s{" "}
              <span className="text-mist">{JSON.stringify(c.data).slice(0, 90)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}