import { useEffect, useRef } from "react";
import type { AppState } from "@/lib/types";

export function Transcript({ state }: { state: AppState }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [state.lines, state.assistantDraft, state.userDraft]);

  const empty = state.lines.length === 0 && !state.assistantDraft && !state.userDraft;

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live transcript</div>
      <div
        ref={scroller}
        aria-live="polite"
        data-testid="transcript"
        className="max-h-64 space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed"
      >
        {empty ? <p className="text-muted-foreground">Both sides show up here as the turn happens.</p> : null}
        {state.lines.map((line) => (
          <p key={line.id}>
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {line.role === "user" ? "You" : "Grok"}
            </span>
            {line.text}
          </p>
        ))}
        {state.userDraft ? (
          <p>
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">You</span>
            {state.userDraft}
          </p>
        ) : null}
        {state.assistantDraft ? (
          <p>
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Grok</span>
            {state.assistantDraft}
          </p>
        ) : null}
      </div>
    </div>
  );
}
