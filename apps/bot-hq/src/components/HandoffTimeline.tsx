import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { handoffs, stageVisual, stages, type Handoff, type StageVisual } from "@/data/handoffs";
import { cn } from "@/lib/utils";

export function HandoffTimeline() {
  const [selectedId, setSelectedId] = useState(handoffs[0].id);
  const selected = handoffs.find((item) => item.id === selectedId) ?? handoffs[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ice">Sample tape</p>
          <h2 className="mt-1 font-serif text-3xl leading-none">Live handoff</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Scout, then the owner, then Builder, then the pull request. Sequence only. This log is bundled.
          </p>
        </div>
        {handoffs.map((handoff) => (
          <ProjectButton key={handoff.id} handoff={handoff} selected={handoff.id === selected.id} onSelect={setSelectedId} />
        ))}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{selected.kicker}</p>
              <h3 className="mt-1 font-serif text-3xl leading-none">{selected.title}</h3>
            </div>
            {selected.hold ? <Badge variant="brass">{selected.hold}</Badge> : <Badge variant="coral">In progress</Badge>}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{selected.summary}</p>
          <p className="font-mono text-xs text-ice">
            {selected.app}
            {selected.pr ? ` · PR #${selected.pr}` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <StageRail handoff={selected} />
          <Separator className="my-5" />
          <ol className="flex flex-col gap-4">
            {selected.events.map((event, index) => (
              <li key={event.stage} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <span className="font-mono text-xs text-brass">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {stages.find((stage) => stage.id === event.stage)?.label} · {event.actor}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{event.text}</p>
                  {event.sources?.map((source) => (
                    <p key={source} className="mt-1 break-all font-mono text-[11px] text-ice/90">
                      {source}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {selected.stage !== "shipped" ? (
            <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">Shipped is still open on this one.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectButton({
  handoff,
  selected,
  onSelect,
}: {
  handoff: Handoff;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      data-handoff-id={handoff.id}
      aria-pressed={selected}
      onClick={() => onSelect(handoff.id)}
      className={cn(
        "glass-panel rounded-xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-brass shadow-[0_0_22px_rgba(240,215,140,0.28)]" : "hover:border-brass/70",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{handoff.kicker}</p>
      <p className="mt-1 font-medium">{handoff.title}</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{handoff.app}</p>
      <div className="mt-3 flex items-center gap-1.5" aria-hidden>
        {stages.map((stage) => {
          const visual = stageVisual(handoff, stage.id);
          return <span key={stage.id} className={cn("h-1.5 flex-1 rounded-full", dotClass(visual))} />;
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{handoff.hold ?? "Building"}</p>
    </button>
  );
}

function StageRail({ handoff }: { handoff: Handoff }) {
  return (
    <ol className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
      <span className="absolute left-[12%] right-[12%] top-4 hidden h-px bg-border sm:block" aria-hidden />
      {stages.map((stage) => {
        const visual = stageVisual(handoff, stage.id);
        const event = handoff.events.find((item) => item.stage === stage.id);
        return (
          <li key={stage.id} className="relative">
            <span className={cn("relative grid size-8 place-items-center rounded-full border", nodeClass(visual))}>
              <span className={cn("size-2 rounded-full", visual === "upcoming" ? "bg-transparent" : "bg-current", visual === "current" && "status-pulse")} />
            </span>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em]">{stage.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{event?.actor ?? "Not yet"}</p>
            {visual === "held" ? <p className="mt-1 text-xs text-brass">{handoff.hold}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function dotClass(visual: StageVisual): string {
  if (visual === "done") return "bg-ice";
  if (visual === "current") return "bg-coral";
  if (visual === "held") return "bg-brass";
  return "bg-border";
}

function nodeClass(visual: StageVisual): string {
  if (visual === "done") return "border-ice bg-ice/15 text-ice";
  if (visual === "current") return "border-coral bg-coral/15 text-coral";
  if (visual === "held") return "border-brass bg-brass/15 text-brass";
  return "border-border bg-background text-muted-foreground";
}
