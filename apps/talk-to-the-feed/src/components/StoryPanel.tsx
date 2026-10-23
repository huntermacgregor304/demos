import { useEffect } from "react";
import { CardSlot, FeedCardView } from "@/components/FeedCard";
import { MoodMeter } from "@/components/MoodMeter";
import { canonicalUrl } from "@/lib/citations";
import { formatAsOf } from "@/lib/story";
import { SOURCE_ORDER, type AppState, type SourceId } from "@/lib/types";

const SOURCE_LABEL: Record<SourceId, string> = {
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
};

export function StoryPanel({ state, fictional }: { state: AppState; fictional: boolean }) {
  const { story, cards, activeCardId, sources, pendingUrls, phase } = state;
  const moods = SOURCE_ORDER.filter((source) => sources[source]).map((source) => {
    return (
      story?.mood.find((mood) => mood.source === source) ?? {
        source,
        positive: 0,
        neutral: 0,
        negative: 0,
        gist: "No read yet",
      }
    );
  });

  useEffect(() => {
    if (!activeCardId) return;
    document.getElementById(`card-${activeCardId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeCardId]);

  if (!story) {
    return (
      <section className="flex min-h-[420px] flex-col justify-end rounded-2xl border border-dashed border-border bg-card/40 p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Grok Story</p>
        <h2 className="mt-3 max-w-xl font-serif text-4xl leading-tight">Ask what people are saying.</h2>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
          {fictional
            ? "Play the sample question. A fictional Orbit Sneakers story will read out, and the cards will land as each one is cited."
            : "Hold the button, ask about a topic, and let go. Grok reads the headline first. Posts and comments show up as they are cited."}
        </p>
      </section>
    );
  }

  const citedCount = cards.filter((card) => card.cited).length;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <span>Grok Story</span>
        <span data-testid="as-of">{formatAsOf(story.asOf)}</span>
        {phase === "speaking" ? <span className="text-primary">{citedCount} of {cards.length} cited</span> : null}
      </div>
      <h2 data-testid="story-headline" className="mt-3 max-w-3xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">
        {story.headline}
      </h2>
      <p data-testid="story-summary" className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/85">
        {story.summary}
      </p>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:gap-6">
        {moods.map((mood) => (
          <MoodMeter key={mood.source} mood={mood} />
        ))}
      </div>
      <div className="mt-8">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Questions people are asking
        </h3>
        <ul className="mt-3 space-y-2" data-testid="questions">
          {story.questions.length === 0 ? (
            <li className="text-sm text-muted-foreground">No questions were pulled from this turn.</li>
          ) : (
            story.questions.map((question) => {
              const card = cards.find((item) => item.id === question.cardId);
              const ready = Boolean(card?.cited);
              return (
                <li key={`${question.cardId}-${question.text}`}>
                  <button
                    type="button"
                    className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-accent disabled:cursor-default disabled:opacity-70"
                    disabled={!ready}
                    onClick={() => document.getElementById(`card-${question.cardId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                  >
                    <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {SOURCE_LABEL[question.source]}
                    </span>
                    <span className="text-sm">{question.text}</span>
                    {!ready ? <span className="ml-auto text-xs text-muted-foreground">when cited</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-3" data-testid="card-grid">
        {cards.map((card, index) =>
          card.cited ? (
            <FeedCardView
              key={card.id}
              card={card}
              active={card.id === activeCardId}
              fictional={fictional}
              pending={pendingUrls.some((url) => canonicalUrl(url) === canonicalUrl(card.url))}
            />
          ) : (
            <CardSlot key={card.id} index={index + 1} />
          ),
        )}
      </div>
    </section>
  );
}
