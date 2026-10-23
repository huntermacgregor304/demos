import type { MoodSplit, SourceId, Story, StoryCardRef, StoryQuestion } from "./types";

export interface ParseResult {
  ok: boolean;
  error: string | null;
  story: Story | null;
}

const SOURCE_ALIASES: Record<string, SourceId> = {
  x: "x",
  twitter: "x",
  facebook: "facebook",
  fb: "facebook",
  youtube: "youtube",
  yt: "youtube",
};

export function normalizeSource(value: unknown): SourceId | null {
  if (typeof value !== "string") return null;
  return SOURCE_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function normalizeCardId(id: string): string {
  const match = id.trim().match(/(\d+)\s*$/);
  if (!match) return id.trim();
  return String(Number(match[1]));
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
}

export function normalizeMood(positive: number, neutral: number, negative: number): [number, number, number] {
  const values = [positive, neutral, negative].map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
  const sum = values[0] + values[1] + values[2];
  if (sum === 0) return [0, 0, 0];
  const fraction = values.every((value) => value <= 1);
  const scaled = fraction ? values.map((value) => value * 100) : values.map((value) => (value / sum) * 100);
  if (!fraction && Math.abs(sum - 100) < 1.5) {
    return values.map((value) => Math.round(value)) as [number, number, number];
  }
  const rounded = scaled.map((value) => Math.round(value));
  rounded[0] += 100 - rounded.reduce((total, value) => total + value, 0);
  return [rounded[0], rounded[1], rounded[2]];
}

export function formatAsOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "as of just now";
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `as of ${time}`;
}

function readMood(value: unknown): MoodSplit | null {
  const record = asObject(value);
  if (!record) return null;
  const source = normalizeSource(record.source);
  if (!source) return null;
  const [positive, neutral, negative] = normalizeMood(
    asNumber(record.positive),
    asNumber(record.neutral),
    asNumber(record.negative),
  );
  const gist = typeof record.gist === "string" ? record.gist.trim() : "";
  return { source, positive, neutral, negative, gist };
}

function readQuestion(value: unknown): StoryQuestion | null {
  const record = asObject(value);
  if (!record) return null;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  const source = normalizeSource(record.source);
  const rawId = record.card_id ?? record.cardId;
  if (!text || !source || typeof rawId !== "string" || !rawId.trim()) return null;
  return { text, source, cardId: normalizeCardId(rawId) };
}

function readCard(value: unknown): StoryCardRef | null {
  const record = asObject(value);
  if (!record) return null;
  const source = normalizeSource(record.source);
  const rawId = record.id;
  if (!source || (typeof rawId !== "string" && typeof rawId !== "number")) return null;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const commentRaw = record.comment_id ?? record.commentId;
  const commentId = typeof commentRaw === "string" && commentRaw.trim() ? commentRaw.trim() : undefined;
  if (source === "youtube") {
    if (!commentId && !url) return null;
  } else if (!url) {
    return null;
  }
  const cue = typeof record.cue === "string" ? record.cue.trim() : "";
  const why = typeof record.why === "string" ? record.why.trim() : "";
  return {
    id: normalizeCardId(String(rawId)),
    source,
    url,
    commentId,
    cue,
    why,
  };
}

export function parseStoryPayload(raw: unknown, now: () => string = () => new Date().toISOString()): ParseResult {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: "render_story arguments were not valid JSON.", story: null };
    }
  }
  const record = asObject(value);
  if (!record) {
    return { ok: false, error: "render_story payload was not an object.", story: null };
  }
  const headline = typeof record.headline === "string" ? record.headline.trim() : "";
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  if (!headline) {
    return { ok: false, error: "render_story is missing a headline.", story: null };
  }
  const mood = Array.isArray(record.mood) ? record.mood.map(readMood).filter((item): item is MoodSplit => Boolean(item)) : [];
  const questions = Array.isArray(record.questions)
    ? record.questions.map(readQuestion).filter((item): item is StoryQuestion => Boolean(item)).slice(0, 6)
    : [];
  const cards = Array.isArray(record.cards)
    ? record.cards.map(readCard).filter((item): item is StoryCardRef => Boolean(item)).slice(0, 8)
    : [];
  const problems: string[] = [];
  if (!summary) problems.push("summary is empty");
  if (cards.length === 0) problems.push("no usable cards");
  return {
    ok: problems.length === 0,
    error: problems.length ? `Story parsed with gaps: ${problems.join(", ")}.` : null,
    story: {
      headline,
      summary,
      mood,
      questions,
      cards,
      asOf: now(),
    },
  };
}
