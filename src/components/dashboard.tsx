import type { KeyMoment, MatchEvent, MatchMeta, MatchState, TeamSide, TeamStats } from "@/types/match";
import { describeEvent } from "@/lib/engine/describe";
import { ExplainButton } from "./ai-panels";
import { MomentIcon, Panel, TEAM_BG, TEAM_BORDER, TEAM_TEXT } from "./ui";

const PERIOD_LABEL: Record<MatchState["period"], string> = {
  pre: "Pre-match",
  first_half: "First half",
  half_time: "Half-time",
  second_half: "Second half",
  full_time: "Full-time",
};

function TeamBlock({ meta, state, side }: { meta: MatchMeta; state: MatchState; side: TeamSide }) {
  const team = meta[side];
  const alignRight = side === "home";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${alignRight ? "flex-row-reverse text-right" : ""}`}>
      <span className={`h-10 w-1.5 shrink-0 rounded-full ${TEAM_BG[side]}`} />
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">
          <span className="hidden sm:inline">{team.name}</span>
          <span className="sm:hidden">{team.shortName}</span>
        </p>
        <p className="text-xs tabular-nums text-mist">
          xG {state.stats[side].xG}
          <span className="hidden sm:inline">, {state.stats[side].shots} shots</span>
        </p>
      </div>
    </div>
  );
}

export function Scorebug({ meta, state, live }: { meta: MatchMeta; state: MatchState; live: boolean }) {
  const totalGoals = state.score.home + state.score.away;
  return (
    <section aria-label="Scoreboard" className="overflow-hidden rounded-md border border-rail bg-deck sm:flex sm:items-stretch">
      <div className="flex items-center justify-between border-b border-rail sm:contents">
        <div className="flex items-center gap-2 bg-tally px-4 py-2 font-display text-lg font-bold tracking-wider text-white sm:order-1">
          {live && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
          {live ? "LIVE" : PERIOD_LABEL[state.period]}
        </div>
        <div className="flex items-baseline gap-2 px-4 py-2 sm:order-3 sm:min-w-24 sm:flex-col sm:items-center sm:justify-center sm:gap-0 sm:border-l sm:border-rail sm:px-5">
          <span className="font-display text-3xl font-bold tabular-nums leading-none">{state.minute}&apos;</span>
          <span className="text-xs text-mist sm:mt-1">{PERIOD_LABEL[state.period]}</span>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-4 px-4 py-3 sm:order-2 sm:gap-8 sm:px-6">
        <TeamBlock meta={meta} state={state} side="home" />
        <div className="font-display text-5xl font-bold tabular-nums leading-none sm:text-6xl" aria-live="polite">
          <span key={`${state.score.home}-${state.score.away}`} className={totalGoals > 0 ? "score-flash" : undefined}>
            {state.score.home}
            <span className="mx-2 text-mist">–</span>
            {state.score.away}
          </span>
        </div>
        <TeamBlock meta={meta} state={state} side="away" />
      </div>
    </section>
  );
}

export function MatchTimeline({ meta, state }: { meta: MatchMeta; state: MatchState }) {
  const series = state.momentumSeries;
  const k = 0.26;
  const homePath = series.length
    ? `M0,30 ${series.map((v, i) => `L${i + 0.5},${30 - Math.max(v, 0) * k}`).join(" ")} L${series.length},30 Z`
    : "";
  const awayPath = series.length
    ? `M0,30 ${series.map((v, i) => `L${i + 0.5},${30 + Math.max(-v, 0) * k}`).join(" ")} L${series.length},30 Z`
    : "";
  const markers = state.keyMoments.filter((m) => m.kind === "goal" || m.kind === "red_card");
  const playhead = Math.min(state.minute, 90);

  return (
    <Panel
      title="Match flow"
      action={
        <p className="text-xs text-mist">
          Momentum{" "}
          <span className={`font-display text-base font-bold tabular-nums ${state.momentum >= 0 ? TEAM_TEXT.home : TEAM_TEXT.away}`}>
            {state.momentum > 0 ? "+" : ""}
            {state.momentum}
          </span>
        </p>
      }
    >
      <div className="relative">
        <p className={`absolute left-0 top-0 text-xs ${TEAM_TEXT.home}`}>{meta.home.shortName} pressure</p>
        <p className={`absolute bottom-6 left-0 text-xs ${TEAM_TEXT.away}`}>{meta.away.shortName} pressure</p>

        <svg viewBox="0 0 90 60" preserveAspectRatio="none" className="h-32 w-full" aria-label="Momentum through the match">
          <line x1="45" x2="45" y1="0" y2="60" stroke="var(--color-mist)" strokeOpacity="0.35" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2="90" y1="30" y2="30" stroke="var(--color-rail)" vectorEffect="non-scaling-stroke" />
          <path d={homePath} fill="var(--color-home)" fillOpacity="0.6" />
          <path d={awayPath} fill="var(--color-away)" fillOpacity="0.6" />
          <line x1={playhead} x2={playhead} y1="0" y2="60" stroke="var(--color-chalk)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>

        {markers.map((m) => (
          <span
            key={m.id}
            title={`${m.minute}' ${m.title}`}
            className={`absolute -translate-x-1/2 ${m.team === "home" ? "top-3" : "bottom-9"}`}
            style={{ left: `${(Math.min(m.minute, 90) / 90) * 100}%` }}
          >
            <MomentIcon kind={m.kind} />
          </span>
        ))}

        <div className="mt-1 flex justify-between font-display text-xs tabular-nums text-mist">
          <span>0&apos;</span>
          <span>Half-time</span>
          <span>90&apos;</span>
        </div>
      </div>
    </Panel>
  );
}

const ROWS: [keyof TeamStats, string][] = [
  ["possession", "Possession %"],
  ["xG", "Expected goals"],
  ["shots", "Shots"],
  ["shotsOnTarget", "On target"],
  ["passAccuracy", "Pass accuracy %"],
  ["corners", "Corners"],
  ["fouls", "Fouls"],
  ["yellowCards", "Yellow cards"],
  ["redCards", "Red cards"],
];

export function StatsPanel({ meta, state }: { meta: MatchMeta; state: MatchState }) {
  return (
    <Panel
      title="Match stats"
      action={
        <p className="font-display text-sm">
          <span className={TEAM_TEXT.home}>{meta.home.shortName}</span>
          <span className="mx-1.5 text-mist">v</span>
          <span className={TEAM_TEXT.away}>{meta.away.shortName}</span>
        </p>
      }
    >
      <div className="space-y-3.5">
        {ROWS.map(([key, label]) => {
          const h = state.stats.home[key];
          const a = state.stats.away[key];
          const pct = h + a === 0 ? 50 : (h / (h + a)) * 100;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-bold tabular-nums">{h}</span>
                <span className="text-xs text-mist">{label}</span>
                <span className="font-display text-lg font-bold tabular-nums">{a}</span>
              </div>
              <div className="mt-1 flex h-1.5 gap-0.5">
                <div className="rounded-l-full bg-home transition-all duration-500" style={{ width: `${pct}%` }} />
                <div className="flex-1 rounded-r-full bg-away" />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function KeyMoments({ moments, minute }: { moments: KeyMoment[]; minute: number }) {
  return (
    <Panel title="Key moments">
      {moments.length === 0 ? (
        <p className="text-sm text-mist">No decisive moments yet. Goals, big chances, red cards and momentum swings will appear here.</p>
      ) : (
        <ol className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
          {[...moments].reverse().map((m) => (
            <li key={m.id} className={`border-l-2 pl-3 ${TEAM_BORDER[m.team]}`}>
              <div className="flex items-start gap-2">
                <MomentIcon kind={m.kind} className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold leading-snug">
                  <span className="mr-1.5 font-display tabular-nums text-mist">{m.minute}&apos;</span>
                  {m.title}
                </p>
              </div>
              <ul className="mt-1.5 space-y-0.5 pl-6 text-xs leading-relaxed text-mist">
                {m.evidence.map((ev) => <li key={ev}>{ev}</li>)}
              </ul>
              <div className="pl-6">
                <ExplainButton momentId={m.id} minute={minute} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function EventFeed({ meta, events }: { meta: MatchMeta; events: MatchEvent[] }) {
  return (
    <Panel title="Event log">
      {events.length === 0 ? (
        <p className="text-sm text-mist">Events appear here once the match starts.</p>
      ) : (
        <ul className="max-h-128 divide-y divide-rail/60 overflow-y-auto pr-1">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-2 text-sm">
              <span className="w-8 shrink-0 font-display tabular-nums text-mist">{e.minute}&apos;</span>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TEAM_BG[e.team]}`} />
              <span className="leading-snug">{describeEvent(e, meta)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}