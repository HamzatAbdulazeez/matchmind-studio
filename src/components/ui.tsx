import type { ReactNode } from "react";
import type { KeyMomentKind, TeamSide } from "@/types/match";

export const TEAM_TEXT: Record<TeamSide, string> = {
  home: "text-home",
  away: "text-away",
};
export const TEAM_BG: Record<TeamSide, string> = {
  home: "bg-home",
  away: "bg-away",
};
export const TEAM_BORDER: Record<TeamSide, string> = {
  home: "border-home",
  away: "border-away",
};

export const selectClass =
  "rounded-md border border-rail bg-deck px-3 py-2 text-sm text-chalk disabled:opacity-50";
export const primaryButton =
  "rounded-md bg-chalk px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-white disabled:opacity-50";

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-rail bg-deck p-4 md:p-5 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-wide">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MomentIcon({
  kind,
  className = "h-4 w-4",
}: {
  kind: KeyMomentKind;
  className?: string;
}) {
  switch (kind) {
    case "goal":
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="var(--color-gold)" />
          <circle cx="8" cy="8" r="2.6" fill="var(--color-night)" />
        </svg>
      );
    case "red_card":
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
          <rect
            x="4"
            y="1.5"
            width="8"
            height="13"
            rx="1.2"
            fill="var(--color-tally)"
          />
        </svg>
      );
    case "big_chance":
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="var(--color-chalk)"
            strokeWidth="1.6"
          />
          <circle cx="8" cy="8" r="2" fill="var(--color-chalk)" />
        </svg>
      );
    case "momentum_shift":
      return (
        <svg
          viewBox="0 0 16 16"
          className={className}
          aria-hidden="true"
          fill="none"
          stroke="var(--color-chalk)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12 L6.5 7.5 L9.5 10 L14 4" />
          <path d="M10.5 4 H14 V7.5" />
        </svg>
      );
    case "pressure_shift":
      return (
        <svg
          viewBox="0 0 16 16"
          className={className}
          aria-hidden="true"
          fill="none"
          stroke="var(--color-chalk)"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M3 3 L7 8 L3 13" />
          <path d="M8 3 L12 8 L8 13" />
        </svg>
      );
    case "chaos":
      return (
        <svg
          viewBox="0 0 16 16"
          className={className}
          aria-hidden="true"
          fill="none"
          stroke="var(--color-chalk)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 9 L4 5 L6.5 11 L9 4 L11.5 12 L14.5 7" />
        </svg>
      );
    case "milestone":
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
          <path
            d="M4 1.5 V14.5"
            stroke="var(--color-chalk)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M4.8 2.5 H13 L10.8 5.5 L13 8.5 H4.8 Z"
            fill="var(--color-gold)"
          />
        </svg>
      );
  }
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="var(--color-turf)" />
      <rect
        x="4"
        y="6"
        width="24"
        height="20"
        rx="1"
        fill="none"
        stroke="var(--color-chalk)"
        strokeWidth="1.4"
      />
      <line
        x1="16"
        y1="6"
        x2="16"
        y2="26"
        stroke="var(--color-chalk)"
        strokeWidth="1.4"
      />
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="none"
        stroke="var(--color-chalk)"
        strokeWidth="1.4"
      />
      <circle cx="16" cy="16" r="1.6" fill="var(--color-gold)" />
    </svg>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap overflow-hidden rounded-md border border-rail">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-2 text-sm transition-colors ${
            value === o.value ? "bg-chalk font-semibold text-night" : "text-mist hover:bg-night/60 hover:text-chalk"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-md border border-rail/70 bg-night/40 p-3">
      <p className="text-xs text-mist">{label}</p>
      <p className={`mt-0.5 font-display text-2xl font-bold tabular-nums leading-tight ${accent ?? ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-mist">{sub}</p>}
    </div>
  );
}