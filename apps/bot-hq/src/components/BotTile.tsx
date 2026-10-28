import { deskMeta, statusLabel, statusTone, type Bot } from "@/data/bots";
import { cn } from "@/lib/utils";

export function BotTile({
  bot,
  selected,
  onSelect,
  className,
  layout = "row",
}: {
  bot: Bot;
  selected: boolean;
  onSelect: (id: string) => void;
  className?: string;
  layout?: "row" | "stack";
}) {
  return (
    <button
      type="button"
      data-bot-id={bot.id}
      aria-pressed={selected}
      title={statusLabel[bot.status]}
      onClick={(event) => {
        onSelect(bot.id);
        event.currentTarget.scrollIntoView({ block: "nearest" });
      }}
      className={cn(
        "flex w-full min-w-0 gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        layout === "stack" ? "flex-col items-center px-1.5 py-2 text-center" : "items-start",
        selected ? "border-ice/70 bg-ice/10" : "border-border/80 bg-background/50 hover:border-ice/40 hover:bg-accent",
        className,
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-card font-mono text-[10px] text-foreground">
        {bot.monogram}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-2", layout === "stack" && "flex-col gap-1")}>
          <span className={cn("text-sm font-medium leading-tight", layout === "stack" && "w-full text-center")}>{bot.name}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground",
              layout === "row" && "ml-auto",
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", statusTone[bot.status], bot.status === "building" && "status-pulse")}
              aria-hidden
            />
            <span className="sr-only">{statusLabel[bot.status]}</span>
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{bot.job}</span>
        {bot.tileNote ? (
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-mint">{bot.tileNote}</span>
        ) : null}
        <span className="sr-only">
          {statusLabel[bot.status]}. {deskMeta[bot.desk].label}.
        </span>
      </span>
    </button>
  );
}
