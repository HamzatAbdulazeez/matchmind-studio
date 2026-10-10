import type { ReactNode } from "react";
import type { KeyMomentKind, TeamSide } from "@/types/match";

export const TEAM_TEXT: Record<TeamSide, string> = { home: "text-home", away: "text-away" };
export const TEAM_BG: Record<TeamSide, string> = { home: "bg-home", away: "bg-away" };
export const TEAM_BORDER: Record<TeamSide, string> = { home: "border-home", away: "border-away" };

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
    <section className={`rounded-lg border border-rail bg-deck p-4 md:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-wide">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MomentIcon({ kind, className = "h-4 w-4" }: { kind: KeyMomentKind; className?: string }) {
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
          <rect x="4" y="1.5" width="8" height="13" rx="1.2" fill="var(--color-tally)" />
        </svg>
      );
    case "big_chance":
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--color-chalk)" strokeWidth="1.6" />
          <circle cx="8" cy="8" r="2" fill="var(--color-chalk)" />
        </svg>
      );
    case "momentum_shift":
      return (
        <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="none" stroke="var(--color-chalk)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12 L6.5 7.5 L9.5 10 L14 4" />
          <path d="M10.5 4 H14 V7.5" />
        </svg>
      );
  }
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="var(--color-turf)" />
      <rect x="4" y="6" width="24" height="20" rx="1" fill="none" stroke="var(--color-chalk)" strokeWidth="1.4" />
      <line x1="16" y1="6" x2="16" y2="26" stroke="var(--color-chalk)" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="var(--color-chalk)" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="1.6" fill="var(--color-gold)" />
    </svg>
  );
}