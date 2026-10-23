import { citeReplaceMap } from "./citations";
import type { SourceId, VoiceId } from "./types";

export const REALTIME_MODEL = "grok-voice-3.0";

export function realtimeSocketUrl(): string {
  const url = new URL("wss://api.x.ai/v1/realtime");
  url.searchParams.set("model", REALTIME_MODEL);
  return url.toString();
}

const YOUTUBE_TOOL = {
  type: "function",
  name: "search_youtube_comments",
  description:
    "Find recent YouTube videos about a topic and return their top comments by relevance. Call this before render_story when YouTube is on. Pass the topic the caller asked about.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Topic to search for on YouTube" },
    },
    required: ["query"],
  },
} as const;

const RENDER_STORY_TOOL = {
  type: "function",
  name: "render_story",
  description:
    "Publish the Grok Story to the screen. Call this exactly once per question, after search tools return and before you speak the story. Do not put post or comment text in this payload. For X and Facebook pass the real url. For YouTube pass comment_id copied from search_youtube_comments.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      headline: { type: "string", description: "One-line headline" },
      summary: { type: "string", description: "Two or three spoken sentences" },
      mood: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source: { type: "string", enum: ["x", "facebook", "youtube"] },
            positive: { type: "number" },
            neutral: { type: "number" },
            negative: { type: "number" },
            gist: { type: "string", description: "Short spoken read, such as mostly positive" },
          },
          required: ["source", "positive", "neutral", "negative", "gist"],
        },
      },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            source: { type: "string", enum: ["x", "facebook", "youtube"] },
            card_id: { type: "string" },
          },
          required: ["text", "source", "card_id"],
        },
      },
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", description: "1 through 8. Say zxcite plus this number before the card." },
            source: { type: "string", enum: ["x", "facebook", "youtube"] },
            url: { type: "string" },
            comment_id: { type: "string" },
            cue: { type: "string", description: "Author name you will say when you discuss this card" },
            why: { type: "string", description: "One line on why this stood out" },
          },
          required: ["id", "source", "url", "cue", "why"],
        },
      },
    },
    required: ["headline", "summary", "mood", "questions", "cards"],
  },
} as const;

export function buildTools(sources: Record<SourceId, boolean>) {
  const tools: Array<Record<string, unknown>> = [];
  if (sources.x) tools.push({ type: "x_search" });
  if (sources.facebook) {
    tools.push({ type: "web_search", allowed_domains: ["facebook.com"] });
  }
  if (sources.youtube) tools.push({ ...YOUTUBE_TOOL });
  tools.push({ ...RENDER_STORY_TOOL });
  return tools;
}

export function buildInstructions(sources: Record<SourceId, boolean>): string {
  const enabled = [
    sources.x ? "X, through x_search" : "",
    sources.facebook ? "Facebook, through web_search limited to facebook.com" : "",
    sources.youtube ? "YouTube comments, through search_youtube_comments" : "",
  ].filter(Boolean);
  const flow = [
    "The caller holds a button and asks what people are saying about a topic.",
    'Say one short line such as "I\'m checking the feed." and start the tools.',
  ];
  if (sources.youtube) {
    flow.push("Call search_youtube_comments first, with the topic in query. Wait for those comments before you judge YouTube.");
  }
  if (sources.x) flow.push("Search X with x_search.");
  if (sources.facebook) {
    flow.push("Search Facebook with web_search. Results only cover public pages and posts on facebook.com.");
  }
  if (!sources.x && !sources.facebook && !sources.youtube) {
    flow.push("No source is switched on. Say that, and ask the caller to turn one on. Do not invent a feed.");
  }
  flow.push(
    "When the tool results are back, call render_story exactly once. Then speak the story.",
    "Speak the headline and the summary first. Then one sentence on the mood, for example: X is mostly positive, YouTube is skeptical. Then take the flagged items one at a time.",
    "Immediately before the sentence about a card, say that card's token as its own word: zxcite1 for card 1, zxcite2 for card 2, through zxcite8. Then say the author name and why it matters, in one or two sentences.",
  );
  const youtubeRule = sources.youtube
    ? "For every YouTube card, copy comment_id from search_youtube_comments and set why to one line about high likes or replies, strong sentiment, controversy, or new information."
    : "";
  return [
    "## Role & Persona",
    "You are Grok, the host of Talk to the Feed. You tell the caller what people are saying on the sources that are switched on. You sound like a sharp editor reading a short story aloud.",
    "",
    "## Objective",
    "Produce one spoken Grok Story grounded only in this turn's tool results, and publish that story with render_story before you speak it.",
    "",
    "## Conversation Flow",
    ...flow.map((line) => `- ${line}`),
    "",
    "## Guardrails & Escalation",
    "- Never invent posts, comments, authors, counts, or quotes. If a tool returns nothing, say so and skip that source.",
    "- Do not offer to post, reply, or draft a response.",
    "- If the caller mentions self-harm, respond with care, tell them they can call or text 988 in the US, and stop the feed topic.",
    "",
    "## Voice & Communication Style",
    "- Respond only in English.",
    "- Spoken words only. No markdown, bullets, emojis, or URLs.",
    "- Keep the story under forty seconds.",
    "- If the question is unclear, ask which topic they mean.",
    "",
    "## CRITICAL INSTRUCTIONS",
    "ALWAYS call render_story once before the spoken story. NEVER speak the story before that call returns.",
    "ALWAYS say the zxcite token as its own word immediately before you discuss that card. The token is removed from the audio. Do not spell it or explain it.",
    "Questions must be real questions from the posts or comments, and each card_id must match a card.",
    "Mood numbers are your read of the items you actually saw. For each enabled source they must sum to 100.",
    youtubeRule,
    `Sources switched on this session: ${enabled.length ? enabled.join("; ") : "none"}.`,
    "Only use tools that are switched on.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSessionUpdate(options: { voice: VoiceId; sources: Record<SourceId, boolean> }) {
  return {
    type: "session.update" as const,
    session: {
      voice: options.voice,
      instructions: buildInstructions(options.sources),
      reasoning: { effort: "none" as const },
      turn_detection: { type: null },
      tools: buildTools(options.sources),
      replace: citeReplaceMap(),
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          transcription: {
            model: "grok-transcribe",
            language_hint: "en",
            keyterms: ["YouTube", "Facebook", "Grok"],
          },
        },
        output: {
          format: { type: "audio/pcm", rate: 24000 },
        },
      },
    },
  };
}

export function readClientSecret(body: unknown): { value: string; expiresAt: number } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const nested = record.client_secret;
  let value = "";
  let expiresAt = 0;
  if (typeof record.value === "string") value = record.value;
  else if (typeof nested === "string") value = nested;
  else if (nested && typeof nested === "object") {
    const secret = nested as Record<string, unknown>;
    if (typeof secret.value === "string") value = secret.value;
    if (typeof secret.expires_at === "number") expiresAt = secret.expires_at;
  }
  if (typeof record.expires_at === "number") expiresAt = record.expires_at;
  if (!value) return null;
  return { value, expiresAt };
}
