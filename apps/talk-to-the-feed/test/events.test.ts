import { describe, expect, test } from "bun:test";
import { reduce, reduceAll, summarizeForDebug } from "../src/lib/events";
import { MOCK_COMMENTS, MOCK_ENRICHMENTS, MOCK_TIMELINE, MOCK_X_URL } from "../src/lib/mock-script";
import { buildSessionUpdate, readClientSecret } from "../src/lib/session-config";
import { createState, type AppState, type RealtimeEvent } from "../src/lib/types";

function withMockSources(state: AppState = createState()): AppState {
  return reduceAll(
    [
      { type: "start_turn" },
      { type: "youtube", comments: MOCK_COMMENTS },
      { type: "enrich", enrichments: MOCK_ENRICHMENTS },
    ],
    state,
  );
}

describe("realtime events", () => {
  test("the scripted session cites cards in spoken order and keeps a clean transcript", () => {
    let state = withMockSources();
    let atFirst = state;
    let atSecond = state;
    for (const step of MOCK_TIMELINE) {
      state = reduce(state, { type: "event", event: step.event });
      const delta = typeof step.event.delta === "string" ? step.event.delta : "";
      if (delta.includes("zxcite1")) atFirst = state;
      if (delta.includes("zxcite2")) atSecond = state;
    }

    expect(atFirst.cards.filter((card) => card.cited).map((card) => card.id)).toEqual(["1"]);
    expect(atFirst.activeCardId).toBe("1");
    expect(atSecond.cards.filter((card) => card.cited).map((card) => card.id)).toEqual(["1", "2"]);
    expect(atSecond.activeCardId).toBe("2");

    expect(state.story?.headline).toBe("Orbit Sneakers split the room");
    expect(state.cards.map((card) => card.id)).toEqual(["1", "2", "3"]);
    expect(state.cards.every((card) => card.cited)).toBe(true);
    expect(state.activeCardId).toBe("3");
    expect(state.lines.some((line) => line.role === "user" && line.text.includes("Orbit Sneakers"))).toBe(true);
    expect(state.lines.some((line) => line.text.includes("checking the feed"))).toBe(true);
    expect(state.lines.some((line) => line.role === "assistant" && line.text.includes("Devon Park"))).toBe(true);
    expect(state.lines.every((line) => !line.text.includes("zxcite"))).toBe(true);
    expect(state.cards.find((card) => card.id === "3")?.text).toContain("real miles");
    expect(JSON.stringify(state.cards)).not.toContain("INVENTED");
    expect(state.phase).toBe("idle");
    expect(state.eventLog).toContain("response.output_audio_transcript.delta");
    expect(state.eventLog).toContain("response.function_call_arguments.done");
  });

  test("batches function calls until response.done and does not treat corpus urls as new cards", () => {
    let state = withMockSources();
    state = reduce(state, {
      type: "event",
      event: {
        type: "response.function_call_arguments.done",
        name: "search_youtube_comments",
        call_id: "call_yt",
        arguments: JSON.stringify({ query: "Orbit Sneakers" }),
      },
    });
    state = reduce(state, {
      type: "event",
      event: {
        type: "response.function_call_arguments.done",
        name: "render_story",
        call_id: "call_story",
        arguments: JSON.stringify({
          headline: "A headline",
          summary: "One sentence. Two sentence.",
          mood: [],
          questions: [],
          cards: [{ id: "1", source: "x", url: MOCK_X_URL, cue: "Mina Cole", why: "Because" }],
        }),
      },
    });
    expect(state.story?.headline).toBe("A headline");
    state = reduce(state, {
      type: "event",
      event: {
        type: "response.done",
        response: { citations: ["https://x.com/i/status/999999"] },
      },
    });
    expect(state.toolBatch?.map((call) => call.name)).toEqual(["search_youtube_comments", "render_story"]);
    expect(state.phase).toBe("thinking");
    expect(state.cards).toHaveLength(1);
    state = reduce(state, { type: "consume_tools" });
    expect(state.toolBatch).toBeNull();
  });

  test("an inline annotation on a content part reveals the matching card", () => {
    let state = withMockSources();
    state = reduce(state, {
      type: "event",
      event: {
        type: "response.function_call_arguments.done",
        name: "render_story",
        call_id: "call_story",
        arguments: JSON.stringify({
          headline: "A headline",
          summary: "One sentence. Two sentence.",
          mood: [],
          questions: [],
          cards: [{ id: "1", source: "x", url: MOCK_X_URL, cue: "Mina Cole", why: "Because" }],
        }),
      },
    });
    const event: RealtimeEvent = {
      type: "response.content_part.done",
      part: { annotations: [{ type: "url_citation", url: MOCK_X_URL }] },
    };
    state = reduce(state, { type: "event", event });
    expect(state.cards[0]?.cited).toBe(true);
    expect(state.activeCardId).toBe("1");
  });

  test("user transcription updates are cumulative and completion commits a line", () => {
    let state = createState();
    state = reduce(state, {
      type: "event",
      event: { type: "conversation.item.input_audio_transcription.updated", transcript: "What are" },
    });
    expect(state.userDraft).toBe("What are");
    state = reduce(state, {
      type: "event",
      event: { type: "conversation.item.input_audio_transcription.completed", transcript: "What are people saying?" },
    });
    expect(state.userDraft).toBe("");
    expect(state.lines.at(-1)?.text).toBe("What are people saying?");
  });

  test("debug logging redacts audio payloads and keeps the event type", () => {
    const summarized = summarizeForDebug({ type: "response.output_audio.delta", delta: "A".repeat(80) });
    expect(summarized.type).toBe("response.output_audio.delta");
    expect(summarized.delta).toBe("[base64 80 chars]");
    expect(summarizeForDebug({ type: "response.output_audio_transcript.delta", delta: "Hello" }).delta).toBe("Hello");
  });

  test("session.update matches the toggles, voice, and manual turn taking", () => {
    const update = buildSessionUpdate({
      voice: "rex",
      sources: { x: true, facebook: false, youtube: true },
    });
    expect(update.session.voice).toBe("rex");
    expect(update.session.turn_detection).toEqual({ type: null });
    expect(update.session.reasoning).toEqual({ effort: "none" });
    expect(update.session.audio.input.format).toEqual({ type: "audio/pcm", rate: 24000 });
    expect(update.session.replace.zxcite1).toBe(" ");
    const names = update.session.tools.map((tool) => tool.type === "function" ? tool.name : tool.type);
    expect(names).toEqual(["x_search", "search_youtube_comments", "render_story"]);
    expect(update.session.instructions).not.toContain("web_search");
    expect(update.session.instructions).toContain("search_youtube_comments");
    expect(update.session.instructions).toContain("## Role & Persona");

    const facebook = buildSessionUpdate({ voice: "ara", sources: { x: false, facebook: true, youtube: false } });
    const facebookTool = facebook.session.tools.find((tool) => tool.type === "web_search");
    expect(facebookTool).toMatchObject({ allowed_domains: ["facebook.com"] });
    expect(facebook.session.instructions).not.toContain("x_search");
    expect(facebook.session.instructions).not.toContain("search_youtube_comments");
  });

  test("reads the documented client secret shapes", () => {
    expect(readClientSecret({ value: "ek_test", expires_at: 100 })?.value).toBe("ek_test");
    expect(readClientSecret({ client_secret: { value: "nested", expires_at: 5 } })).toEqual({
      value: "nested",
      expiresAt: 5,
    });
    expect(readClientSecret({ client_secret: "plain" })?.value).toBe("plain");
    expect(readClientSecret({})).toBeNull();
  });
});
