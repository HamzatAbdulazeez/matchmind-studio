import type { CommentaryLine } from "@/types/ai";
import { Panel } from "./ui";

function LineText({ line, featured }: { line: CommentaryLine; featured: boolean }) {
  const main = line.translated ?? line.text;
  return (
    <>
      <span dir={line.translated && line.language === "Arabic" ? "rtl" : "ltr"} className={featured ? "text-chalk" : ""}>
        {main}
      </span>
      {line.translated && <span className="mt-1 block text-xs text-mist">{line.text}</span>}
    </>
  );
}

export function CommentaryPanel({ lines, live }: { lines: CommentaryLine[]; live: boolean }) {
  const [latest, ...earlier] = lines;

  return (
    <Panel
      title="Live commentary"
      className="flex flex-col"
      action={
        live ? (
          <span className="flex items-center gap-1.5 rounded-sm bg-tally px-2 py-0.5 font-display text-sm font-bold tracking-wider text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            ON AIR
          </span>
        ) : null
      }
    >
      {!latest ? (
        <p className="text-sm text-mist">
          {live ? "Waiting for the first big moment…" : "Commentary appears here as the match plays."}
        </p>
      ) : (
        <>
          <div aria-live="polite" className="rounded-md border-l-4 border-gold bg-night/60 p-4">
            <p className="font-display text-sm font-semibold tabular-nums text-gold">{latest.minute}&apos;</p>
            <p className="mt-1 text-lg leading-snug">
              <LineText line={latest} featured />
            </p>
          </div>
          {lines.some((l) => l.source === "fallback") && (
            <p className="mt-2 text-xs text-gold">
              AI is offline, so these are template lines. Add your Azure OpenAI keys for real commentary.
            </p>
          )}
          {earlier.length > 0 && (
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {earlier.map((l) => (
                <li key={l.id} className="flex gap-3 text-sm leading-relaxed text-mist">
                  <span className="w-8 shrink-0 font-display font-semibold tabular-nums">{l.minute}&apos;</span>
                  <span className="min-w-0">
                    <LineText line={l} featured={false} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}