export type SourceId = "x" | "facebook" | "youtube";

export type VoiceId = "eve" | "ara" | "rex";

export interface VoiceOption {
  id: VoiceId;
  name: string;
  tone: string;
}

export const VOICES: VoiceOption[] = [
  { id: "eve", name: "Eve", tone: "Energetic and upbeat, British accent" },
  { id: "ara", name: "Ara", tone: "Warm and friendly" },
  { id: "rex", name: "Rex", tone: "Confident and clear" },
];

export const SOURCE_ORDER: SourceId[] = ["x", "facebook", "youtube"];

export interface MoodSplit {
  source: SourceId;
  positive: number;
  neutral: number;
  negative: number;
  gist: string;
}

export interface StoryQuestion {
  text: string;
  source: SourceId;
  cardId: string;
}

export interface StoryCardRef {
  id: string;
  source: SourceId;
  url: string;
  commentId?: string;
  cue: string;
  why: string;
}

export interface Story {
  headline: string;
  summary: string;
  mood: MoodSplit[];
  questions: StoryQuestion[];
  cards: StoryCardRef[];
  asOf: string;
}

export interface YoutubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
}

export interface YoutubeComment {
  commentId: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  authorName: string;
  text: string;
  likeCount: number;
  replyCount: number;
  publishedAt: string;
  url: string;
}

export type EnrichProvider = "oembed" | "opengraph" | "none";

export interface Enrichment {
  url: string;
  source: SourceId | "web";
  authorName: string;
  handle: string;
  text: string;
  thumbnail?: string;
  avatar?: string;
  provider: EnrichProvider;
  ok: boolean;
}

export type CardContentFrom = "youtube" | "oembed" | "opengraph" | "unavailable";

export interface FeedCard {
  id: string;
  source: SourceId;
  url: string;
  cue: string;
  why: string;
  authorName: string;
  handle: string;
  text: string;
  thumbnail?: string;
  avatar?: string;
  videoTitle?: string;
  likeCount?: number;
  replyCount?: number;
  cited: boolean;
  contentFrom: CardContentFrom;
}

export interface TranscriptLine {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface FunctionCall {
  name: string;
  callId: string;
  arguments: string;
}

export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

export interface AppState {
  connection: "idle" | "connecting" | "ready" | "closed";
  phase: "idle" | "listening" | "thinking" | "speaking";
  voice: VoiceId;
  sources: Record<SourceId, boolean>;
  debug: boolean;
  error: string | null;
  notice: string | null;
  lines: TranscriptLine[];
  responseRaw: string;
  citationRaw: string;
  assistantDraft: string;
  userDraft: string;
  story: Story | null;
  cards: FeedCard[];
  activeCardId: string | null;
  youtubeComments: YoutubeComment[];
  enrichments: Record<string, Enrichment>;
  pendingUrls: string[];
  pendingCalls: FunctionCall[];
  argBuffers: Record<string, string>;
  responseHasAudio: boolean;
  toolBatch: FunctionCall[] | null;
  eventLog: string[];
  lineSeq: number;
}

export type Action =
  | { type: "event"; event: RealtimeEvent }
  | { type: "youtube"; comments: YoutubeComment[] }
  | { type: "enrich"; enrichments: Enrichment[] }
  | { type: "enrich_start"; urls: string[] }
  | { type: "render_story"; raw: string }
  | { type: "consume_tools" }
  | { type: "set_voice"; voice: VoiceId }
  | { type: "set_source"; source: SourceId; enabled: boolean }
  | { type: "set_debug"; enabled: boolean }
  | { type: "connection"; connection: AppState["connection"]; error?: string | null }
  | { type: "phase"; phase: AppState["phase"] }
  | { type: "start_turn" }
  | { type: "notice"; notice: string | null };

export function defaultSources(): Record<SourceId, boolean> {
  return { x: true, facebook: true, youtube: true };
}

export function createState(partial: Partial<AppState> = {}): AppState {
  return {
    connection: "idle",
    phase: "idle",
    voice: "eve",
    sources: defaultSources(),
    debug: false,
    error: null,
    notice: null,
    lines: [],
    responseRaw: "",
    citationRaw: "",
    assistantDraft: "",
    userDraft: "",
    story: null,
    cards: [],
    activeCardId: null,
    youtubeComments: [],
    enrichments: {},
    pendingUrls: [],
    pendingCalls: [],
    argBuffers: {},
    responseHasAudio: false,
    toolBatch: null,
    eventLog: [],
    lineSeq: 1,
    ...partial,
  };
}
