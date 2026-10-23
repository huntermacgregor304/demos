import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FeedCard as FeedCardModel, SourceId } from "@/lib/types";

const SOURCE_LABEL: Record<SourceId, string> = {
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
};

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

export function FeedCardView({
  card,
  active,
  pending,
  fictional,
}: {
  card: FeedCardModel;
  active: boolean;
  pending: boolean;
  fictional: boolean;
}) {
  const hrefLabel =
    card.source === "youtube" ? "View comment" : card.source === "facebook" ? "View on Facebook" : "View on X";
  return (
    <article
      id={`card-${card.id}`}
      data-testid="feed-card"
      data-source={card.source}
      data-active={active ? "true" : "false"}
      className={`cite-in flex h-full flex-col rounded-xl border bg-card p-4 ${
        active ? "border-primary shadow-[0_0_0_1px_#e7ff3d]" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-start gap-3">
        {card.avatar ? (
          <img src={card.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
            {initials(card.authorName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium leading-tight">{card.authorName}</div>
          {card.handle ? <div className="truncate text-sm text-muted-foreground">{card.handle}</div> : null}
        </div>
        <Badge variant={card.source}>{SOURCE_LABEL[card.source]}</Badge>
      </div>
      {card.text ? (
        <p className="text-sm leading-relaxed text-foreground/95">{card.text}</p>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {pending
            ? "Fetching the original post…"
            : "Preview unavailable. Open the original — this card does not invent the post."}
        </p>
      )}
      {card.thumbnail ? (
        <img
          src={card.thumbnail}
          alt=""
          className="mt-3 h-28 w-full rounded-md border border-border object-cover"
        />
      ) : null}
      {card.videoTitle ? <p className="mt-2 text-xs text-muted-foreground">{card.videoTitle}</p> : null}
      {card.source === "youtube" && card.likeCount != null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {card.likeCount.toLocaleString()} likes · {card.replyCount?.toLocaleString() ?? 0} replies
        </p>
      ) : null}
      {card.why ? (
        <p className="mt-3 border-l-2 border-primary/80 pl-3 text-sm leading-snug">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Why it stood out
          </span>
          {card.why}
        </p>
      ) : card.source === "youtube" ? (
        <p className="mt-3 text-xs text-muted-foreground">Grok didn’t include a why-tag for this comment.</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        {fictional ? <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fictional</span> : <span />}
        <a
          className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline"
          href={card.url}
          target="_blank"
          rel="noreferrer"
        >
          {hrefLabel}
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      {active ? (
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Citing now</p>
      ) : null}
    </article>
  );
}

export function CardSlot({ index }: { index: number }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
      Citation {index} appears when Grok says it
    </div>
  );
}
