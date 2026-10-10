import type { MatchMeta, MatchState, ShotPoint, TeamSide } from "@/types/match";
import { Panel, TEAM_TEXT } from "./ui";

const W = 105;
const H = 68;
const COLOR: Record<TeamSide, string> = { home: "var(--color-home)", away: "var(--color-away)" };
const RESULT_LABEL: Record<ShotPoint["result"], string> = {
  goal: "goal", saved: "saved", on_target: "on target", off_target: "off target",
};

// Home attacks right, away attacks left
const toX = (s: ShotPoint) => ((s.team === "home" ? s.x : 100 - s.x) / 100) * W;
const toY = (s: ShotPoint) => (s.y / 100) * H;

function PitchLines() {
  const arcY = 7.31; 
  return (
    <g fill="none" stroke="var(--color-chalk)" strokeOpacity="0.6" strokeWidth="0.3">
      <rect x="0" y="0" width={W} height={H} />
      <line x1={W / 2} y1="0" x2={W / 2} y2={H} />
      <circle cx={W / 2} cy={H / 2} r="9.15" />
      <rect x="0" y={H / 2 - 20.16} width="16.5" height="40.32" />
      <rect x="0" y={H / 2 - 9.16} width="5.5" height="18.32" />
      <path d={`M 16.5 ${H / 2 - arcY} A 9.15 9.15 0 0 1 16.5 ${H / 2 + arcY}`} />
      <rect x={W - 16.5} y={H / 2 - 20.16} width="16.5" height="40.32" />
      <rect x={W - 5.5} y={H / 2 - 9.16} width="5.5" height="18.32" />
      <path d={`M ${W - 16.5} ${H / 2 - arcY} A 9.15 9.15 0 0 0 ${W - 16.5} ${H / 2 + arcY}`} />
      <rect x="-1.6" y={H / 2 - 3.66} width="1.6" height="7.32" />
      <rect x={W} y={H / 2 - 3.66} width="1.6" height="7.32" />
      <g fill="var(--color-chalk)" fillOpacity="0.6" stroke="none">
        <circle cx={W / 2} cy={H / 2} r="0.4" />
        <circle cx="11" cy={H / 2} r="0.4" />
        <circle cx={W - 11} cy={H / 2} r="0.4" />
      </g>
    </g>
  );
}

export function PitchView({
  shots,
  meta,
  momentum = 0,
}: {
  shots: ShotPoint[];
  meta?: MatchMeta | null;
  momentum?: number;
}) {
  const dominant: TeamSide = momentum >= 0 ? "home" : "away";

  return (
    <svg
      viewBox="-2.5 -2.5 110 73"
      className="h-auto w-full rounded-md"
      role="img"
      aria-label={`Shot map with ${shots.length} shots`}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={-2.5 + i * 11} y="-2.5" width="11" height="73" fill={i % 2 ? "var(--color-turf-2)" : "var(--color-turf)"} />
      ))}

      {/* Territory: the side under pressure glows in the attacking team's colour */}
      {momentum !== 0 && (
        <rect
          x={dominant === "home" ? W / 2 : 0}
          y="0"
          width={W / 2}
          height={H}
          fill={COLOR[dominant]}
          fillOpacity={Math.min(Math.abs(momentum) / 450, 0.2)}
        />
      )}

      <PitchLines />

      {meta && (
        <g fontFamily="var(--font-display)" fontSize="2.6" fill="var(--color-chalk)" fillOpacity="0.7">
          <text x="2" y={H - 2}>{meta.home.shortName} attack →</text>
          <text x={W - 2} y="4.4" textAnchor="end">← {meta.away.shortName} attack</text>
        </g>
      )}

      {shots.map((s, i) => {
        const r = 0.9 + s.xG * 3.2;
        const cx = toX(s);
        const cy = toY(s);
        const c = COLOR[s.team];
        return (
          <g key={s.id}>
            <title>{`${s.minute}' ${s.player}: ${RESULT_LABEL[s.result]} (xG ${s.xG})`}</title>
            {s.result === "goal" ? (
              <>
                <circle cx={cx} cy={cy} r={r + 0.9} fill="none" stroke="var(--color-gold)" strokeWidth="0.4" />
                <circle cx={cx} cy={cy} r={r} fill="var(--color-gold)" stroke={c} strokeWidth="0.5" />
              </>
            ) : s.result === "off_target" ? (
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="0.45" />
            ) : (
              <circle cx={cx} cy={cy} r={r} fill={c} fillOpacity="0.8" />
            )}
            {i === shots.length - 1 && (
              <circle cx={cx} cy={cy} r={r + 1.4} fill="none" stroke={c} strokeWidth="0.35" className="shot-pulse" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LegendDot({ kind }: { kind: "goal" | "on" | "off" }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
      {kind === "goal" && <circle cx="6" cy="6" r="4.5" fill="var(--color-gold)" />}
      {kind === "on" && <circle cx="6" cy="6" r="4.5" fill="var(--color-chalk)" fillOpacity="0.8" />}
      {kind === "off" && <circle cx="6" cy="6" r="4" fill="none" stroke="var(--color-chalk)" strokeWidth="1.3" />}
    </svg>
  );
}

export function ShotMapPanel({ meta, state }: { meta: MatchMeta; state: MatchState }) {
  return (
    <Panel
      title="Shot map"
      action={
        <p className="font-display text-sm tabular-nums">
          <span className={TEAM_TEXT.home}>{meta.home.shortName} {state.stats.home.xG} xG</span>
          <span className="mx-2 text-mist">/</span>
          <span className={TEAM_TEXT.away}>{meta.away.shortName} {state.stats.away.xG} xG</span>
        </p>
      }
    >
      <PitchView shots={state.shotMap} meta={meta} momentum={state.momentum} />
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-mist">
        <span className="flex items-center gap-1.5"><LegendDot kind="goal" /> Goal</span>
        <span className="flex items-center gap-1.5"><LegendDot kind="on" /> Saved or on target</span>
        <span className="flex items-center gap-1.5"><LegendDot kind="off" /> Off target</span>
        <span>Bigger circle means a better chance (higher xG). Hover a shot for details.</span>
      </div>
    </Panel>
  );
}