import { useState } from "react";
import { BotTile } from "@/components/BotTile";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  bots,
  deskMeta,
  displayName,
  getBot,
  loopOrder,
  relationshipLines,
  statusLabel,
  statusTone,
  type Bot,
  type DeskId,
} from "@/data/bots";
import { cn } from "@/lib/utils";

export function OrgFloor() {
  const [selectedId, setSelectedId] = useState("builder");
  const selected = getBot(selectedId);

  return (
    <div className="flex flex-col gap-3 xl:h-full xl:min-h-0 xl:flex-row">
      <div data-floor-scroll className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-auto xl:pr-1">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-muted-foreground">Each tile is a bot and the job it holds. Select one for the standing order.</p>
          <ul className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
            {(Object.keys(statusLabel) as (keyof typeof statusLabel)[]).map((status) => (
              <li key={status} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", statusTone[status])} aria-hidden />
                {statusLabel[status]}
              </li>
            ))}
          </ul>
        </div>

        <section className={cn("rounded-xl border border-border bg-card p-3", deskMeta.command.accent, "border-t-2")}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">{deskMeta.command.label}</h2>
            <p className="text-xs text-muted-foreground">{deskMeta.command.blurb}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 sm:w-72">
              <BotTile bot={getBot("goku")} selected={selectedId === "goku"} onSelect={setSelectedId} />
            </div>
            <div className="flex items-center gap-2 px-1 text-brass sm:flex-col">
              <span className="hidden h-px w-8 bg-brass/60 sm:block" aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">staff</span>
              <span className="hidden h-px w-8 bg-brass/60 sm:block" aria-hidden />
            </div>
            <div className="min-w-0 sm:w-72">
              <BotTile bot={getBot("queen")} selected={selectedId === "queen"} onSelect={setSelectedId} />
            </div>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground sm:pl-4">
              A line on this chart is a stated report or the build loop. Desks are groupings. Queen routes the queue and does not approve.
            </p>
          </div>
        </section>

        <div className="my-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">The floor</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Desk id="demo" layout="stack" selectedId={selectedId} onSelect={setSelectedId} />
            <Desk id="loop" layout="stack" selectedId={selectedId} onSelect={setSelectedId} />
            <Desk id="media" layout="stack" selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <Desk id="crypto" layout="band" selectedId={selectedId} onSelect={setSelectedId} />
          <div className="grid gap-3 md:grid-cols-2">
            <Desk id="intel" layout="row" selectedId={selectedId} onSelect={setSelectedId} />
            <Desk id="crew" layout="row" selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </div>
      </div>
      <Dossier bot={selected} />
    </div>
  );
}

function Desk({
  id,
  layout,
  selectedId,
  onSelect,
}: {
  id: DeskId;
  layout: "stack" | "band" | "row";
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const meta = deskMeta[id];
  const members = bots.filter((bot) => bot.desk === id && bot.id !== "clip-editor");

  return (
    <section data-desk={id} className={cn("rounded-xl border border-border bg-card p-3", meta.accent, "border-t-2")}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">{meta.label}</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{meta.blurb}</p>
      {id === "loop" ? (
        <BuildLoop selectedId={selectedId} onSelect={onSelect} />
      ) : id === "media" ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-border/80 bg-background/30 p-1.5">
            <BotTile bot={getBot("yt-master")} selected={selectedId === "yt-master"} onSelect={onSelect} className="border-transparent bg-transparent" />
            <div className="ml-4 mt-1 border-l border-violet/50 py-1 pl-2">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-violet">Reports up</p>
              <BotTile bot={getBot("clip-editor")} selected={selectedId === "clip-editor"} onSelect={onSelect} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {members
              .filter((bot) => bot.id !== "yt-master")
              .map((bot) => (
                <BotTile key={bot.id} bot={bot} selected={selectedId === bot.id} onSelect={onSelect} />
              ))}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-2",
            layout === "band" && "sm:grid-cols-2 xl:grid-cols-5",
            layout === "row" && "xl:grid-cols-3",
          )}
        >
          {members.map((bot) => (
            <BotTile key={bot.id} bot={bot} selected={selectedId === bot.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function BuildLoop({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const hands = ["Plan", "Do", "Critique"];

  return (
    <div>
      <ol className="flex items-stretch gap-1">
        {loopOrder.map((id, index) => (
          <li key={id} className="flex min-w-0 flex-1 items-stretch gap-1">
            {index > 0 ? (
              <span className="flex items-center font-mono text-xs text-violet" aria-hidden>
                →
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <BotTile bot={getBot(id)} selected={selectedId === id} onSelect={onSelect} layout="stack" />
              <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-violet">{hands[index]}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-violet">
        <span aria-hidden>↩</span>
        Back to Tanner. The loop repeats.
      </p>
    </div>
  );
}

function Dossier({ bot }: { bot: Bot }) {
  const lines = relationshipLines(bot);
  return (
    <aside
      aria-live="polite"
      className="shrink-0 rounded-xl border border-border bg-card px-4 py-3 xl:w-[300px] xl:overflow-auto"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-background font-mono text-xs">
          {bot.monogram}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl leading-none">{displayName(bot)}</h2>
            <Badge variant={badgeFor(bot)}>{statusLabel[bot.status]}</Badge>
            {bot.advisesOnly ? <Badge variant="brass">Advises only</Badge> : null}
          </div>
          <p className="mt-1.5 text-sm text-foreground/90">{bot.job}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{deskMeta[bot.desk].label}</p>
      </div>
      <Separator className="my-3" />
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <DossierBlock label="Standing order" body={bot.standingOrder} />
        <DossierBlock label="On the chart" body={lines.join(" ")} />
        <DossierBlock label="Sample now" body={bot.now ?? "No sample assignment on this tape."} />
      </div>
    </aside>
  );
}

function DossierBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</h3>
      <p className="mt-1 text-sm leading-relaxed text-foreground/90">{body}</p>
    </div>
  );
}

function badgeFor(bot: Bot) {
  if (bot.status === "building") return "coral" as const;
  if (bot.status === "scouting") return "ice" as const;
  if (bot.status === "advising") return "brass" as const;
  if (bot.status === "loop") return "violet" as const;
  if (bot.status === "on-duty") return "mint" as const;
  return "outline" as const;
}
