import type { MoodSplit } from "@/lib/types";

const LABELS = { x: "X", facebook: "Facebook", youtube: "YouTube" } as const;

export function MoodMeter({ mood }: { mood: MoodSplit }) {
  const empty = mood.positive + mood.neutral + mood.negative === 0;
  return (
    <div className="min-w-0 flex-1" data-testid={`mood-${mood.source}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{LABELS[mood.source]}</span>
        <span className="truncate text-xs text-foreground/80">{mood.gist}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden={empty}>
        {empty ? (
          <div className="h-full w-full bg-border" />
        ) : (
          <>
            <div className="h-full bg-[#c6ef71]" style={{ width: `${mood.positive}%` }} />
            <div className="h-full bg-[#d9d3c7]" style={{ width: `${mood.neutral}%` }} />
            <div className="h-full bg-[#ff7a6e]" style={{ width: `${mood.negative}%` }} />
          </>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {empty ? "Waiting for a read" : `${mood.positive}% positive · ${mood.neutral}% neutral · ${mood.negative}% negative`}
      </p>
    </div>
  );
}
