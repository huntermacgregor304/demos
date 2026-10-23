import { assembleFeed, canonicalUrl, extractCitationUrls, projectCitations, stripMarkers } from "./citations";
import { parseStoryPayload } from "./story";
import {
  createState,
  type Action,
  type AppState,
  type FunctionCall,
  type RealtimeEvent,
  type Story,
} from "./types";

const AUDIO_DELTA = new Set(["response.output_audio.delta", "response.audio.delta"]);
const TRANSCRIPT_DELTA = new Set([
  "response.output_audio_transcript.delta",
  "response.audio_transcript.delta",
  "response.output_text.delta",
  "response.text.delta",
]);
const TRANSCRIPT_DONE = new Set([
  "response.output_audio_transcript.done",
  "response.audio_transcript.done",
]);

function withLog(state: AppState, eventType: string): AppState {
  return { ...state, eventLog: [...state.eventLog, eventType].slice(-300) };
}

function project(state: AppState, story: Story | null = state.story): AppState {
  if (!story) return { ...state, story: null, cards: [], activeCardId: null };
  const assembled = assembleFeed(story, state.youtubeComments, state.enrichments);
  const projected = projectCitations(assembled, state.citationRaw, story);
  return { ...state, story, cards: projected.cards, activeCardId: projected.activeId };
}

function applyRender(state: AppState, raw: string): AppState {
  const parsed = parseStoryPayload(raw);
  if (!parsed.story) {
    return { ...state, notice: parsed.error };
  }
  return project({ ...state, notice: parsed.error }, parsed.story);
}

function textField(event: RealtimeEvent, key: string): string {
  const value = event[key];
  return typeof value === "string" ? value : "";
}

function upsertCall(state: AppState, call: FunctionCall): AppState {
  if (state.pendingCalls.some((existing) => existing.callId === call.callId)) return state;
  const pendingCalls = [...state.pendingCalls, call];
  const next = { ...state, pendingCalls };
  if (call.name === "render_story") return applyRender(next, call.arguments);
  return next;
}

function callFromEvent(state: AppState, event: RealtimeEvent): FunctionCall | null {
  if (event.type === "response.function_call_arguments.delta") {
    const callId = textField(event, "call_id");
    if (!callId) return null;
    const buffers = { ...state.argBuffers, [callId]: `${state.argBuffers[callId] ?? ""}${textField(event, "delta")}` };
    return { name: "", callId, arguments: buffers[callId] };
  }
  if (event.type === "response.function_call_arguments.done") {
    const callId = textField(event, "call_id");
    const name = textField(event, "name");
    if (!callId || !name) return null;
    const buffered = state.argBuffers[callId] ?? "";
    const args = textField(event, "arguments") || buffered;
    return { name, callId, arguments: args };
  }
  if (event.type === "response.output_item.done") {
    const item = event.item;
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (record.type !== "function_call") return null;
    const callId = typeof record.call_id === "string" ? record.call_id : "";
    const name = typeof record.name === "string" ? record.name : "";
    const args = typeof record.arguments === "string" ? record.arguments : state.argBuffers[callId] ?? "";
    if (!callId || !name) return null;
    return { name, callId, arguments: args };
  }
  return null;
}

function errorMessage(event: RealtimeEvent): string {
  const nested = event.error;
  if (typeof nested === "string") return nested;
  if (nested && typeof nested === "object" && typeof (nested as { message?: unknown }).message === "string") {
    return (nested as { message: string }).message;
  }
  if (typeof event.message === "string") return event.message;
  return "The realtime session reported an error.";
}

function userTranscript(event: RealtimeEvent): string {
  if (typeof event.transcript === "string") return event.transcript;
  const item = event.item;
  if (item && typeof item === "object" && typeof (item as { transcript?: unknown }).transcript === "string") {
    return (item as { transcript: string }).transcript;
  }
  return "";
}

function appendTranscript(state: AppState, delta: string): AppState {
  const responseRaw = state.responseRaw + delta;
  const citationRaw = state.citationRaw + delta;
  const assistantDraft = stripMarkers(responseRaw);
  return project({ ...state, responseRaw, citationRaw, assistantDraft, phase: "speaking", responseHasAudio: state.responseHasAudio });
}

function pushLine(state: AppState, role: "user" | "assistant", text: string): AppState {
  const line = { id: `${role === "user" ? "u" : "a"}${state.lineSeq}`, role, text };
  return {
    ...state,
    lines: [...state.lines, line].slice(-50),
    lineSeq: state.lineSeq + 1,
  };
}

function commitAssistant(state: AppState): AppState {
  const text = stripMarkers(state.responseRaw).trim();
  if (!text) return { ...state, assistantDraft: "" };
  const last = state.lines.at(-1);
  if (last?.role === "assistant" && last.text === text) {
    return { ...state, assistantDraft: "" };
  }
  return { ...pushLine(state, "assistant", text), assistantDraft: "" };
}

function absorbFullTranscript(state: AppState, full: string): AppState {
  if (!full) return state;
  if (!state.responseRaw) {
    return project({
      ...state,
      responseRaw: full,
      citationRaw: state.citationRaw + full,
      assistantDraft: stripMarkers(full),
    });
  }
  if (full.startsWith(state.responseRaw) && full.length > state.responseRaw.length) {
    const extra = full.slice(state.responseRaw.length);
    return project({
      ...state,
      responseRaw: full,
      citationRaw: state.citationRaw + extra,
      assistantDraft: stripMarkers(full),
    });
  }
  return state;
}

function onRealtimeEvent(state: AppState, event: RealtimeEvent): AppState {
  let next = withLog(state, event.type);
  if (event.type === "response.function_call_arguments.delta") {
    const callId = textField(event, "call_id");
    if (callId) {
      next = {
        ...next,
        argBuffers: { ...next.argBuffers, [callId]: `${next.argBuffers[callId] ?? ""}${textField(event, "delta")}` },
      };
    }
    return next;
  }

  const call = callFromEvent(next, event);
  if (call?.name) next = upsertCall(next, call);

  if (event.type === "response.created") {
    const citationRaw = next.citationRaw && !next.citationRaw.endsWith(" ") ? `${next.citationRaw} ` : next.citationRaw;
    return project({
      ...next,
      responseRaw: "",
      assistantDraft: "",
      citationRaw,
      responseHasAudio: false,
      phase: next.phase === "listening" ? "listening" : "thinking",
    });
  }

  if (AUDIO_DELTA.has(event.type)) {
    return { ...next, phase: "speaking", responseHasAudio: true };
  }

  if (TRANSCRIPT_DELTA.has(event.type)) {
    return appendTranscript(next, textField(event, "delta"));
  }

  if (TRANSCRIPT_DONE.has(event.type)) {
    return absorbFullTranscript(next, textField(event, "transcript"));
  }

  if (event.type === "conversation.item.input_audio_transcription.updated") {
    return { ...next, userDraft: userTranscript(event) };
  }

  if (event.type === "conversation.item.input_audio_transcription.completed") {
    const text = userTranscript(event).trim();
    if (!text) return { ...next, userDraft: "" };
    return { ...pushLine(next, "user", text), userDraft: "" };
  }

  if (event.type === "response.done") {
    const inline = extractCitationUrls(event).filter((item) => item.inline);
    const withInline = inline.length
      ? project({ ...next, citationRaw: `${next.citationRaw} ${inline.map((item) => item.url).join(" ")}` })
      : next;
    const committed = commitAssistant(withInline);
    if (committed.pendingCalls.length) {
      return {
        ...committed,
        phase: "thinking",
        toolBatch: committed.pendingCalls,
        pendingCalls: [],
        responseHasAudio: false,
      };
    }
    return {
      ...committed,
      phase: committed.responseHasAudio ? "idle" : committed.phase === "speaking" ? "idle" : committed.phase,
      responseHasAudio: false,
      toolBatch: null,
    };
  }

  if (event.type === "error") {
    return { ...next, error: errorMessage(event) };
  }

  const inline = extractCitationUrls(event).filter((item) => item.inline);
  if (inline.length && next.story) {
    const addition = inline.map((item) => item.url).join(" ");
    return project({ ...next, citationRaw: `${next.citationRaw} ${addition}` });
  }

  return next;
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "event":
      return onRealtimeEvent(state, action.event);
    case "youtube":
      return project({ ...state, youtubeComments: action.comments });
    case "enrich": {
      const enrichments = { ...state.enrichments };
      for (const enrichment of action.enrichments) enrichments[enrichment.url] = enrichment;
      const done = new Set(action.enrichments.map((item) => canonicalUrl(item.url)));
      return project({
        ...state,
        enrichments,
        pendingUrls: state.pendingUrls.filter((url) => !done.has(canonicalUrl(url))),
      });
    }
    case "enrich_start":
      return { ...state, pendingUrls: [...new Set([...state.pendingUrls, ...action.urls])] };
    case "render_story":
      return applyRender(state, action.raw);
    case "consume_tools":
      return { ...state, toolBatch: null };
    case "set_voice":
      return { ...state, voice: action.voice };
    case "set_source":
      return { ...state, sources: { ...state.sources, [action.source]: action.enabled } };
    case "set_debug":
      return { ...state, debug: action.enabled };
    case "connection":
      return { ...state, connection: action.connection, error: action.error === undefined ? state.error : action.error };
    case "phase":
      return { ...state, phase: action.phase };
    case "notice":
      return { ...state, notice: action.notice };
    case "start_turn":
      return {
        ...state,
        phase: "listening",
        story: null,
        cards: [],
        activeCardId: null,
        responseRaw: "",
        citationRaw: "",
        assistantDraft: "",
        userDraft: "",
        youtubeComments: [],
        enrichments: {},
        pendingUrls: [],
        pendingCalls: [],
        argBuffers: {},
        toolBatch: null,
        responseHasAudio: false,
        notice: null,
        error: null,
        lines: [],
        lineSeq: 1,
      };
    default:
      return state;
  }
}

export function summarizeForDebug(event: RealtimeEvent): RealtimeEvent {
  if (typeof event.delta === "string" && event.type.includes("audio") && event.delta.length > 64) {
    return { ...event, delta: `[base64 ${event.delta.length} chars]` };
  }
  return event;
}

export function reduceAll(actions: Action[], state: AppState = createState()): AppState {
  return actions.reduce(reduce, state);
}
