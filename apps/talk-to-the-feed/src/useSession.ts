import { useCallback, useEffect, useRef, useState } from "react";
import { canonicalUrl, sourceFromUrl, urlsNeedingEnrichment } from "@/lib/citations";
import { reduce, summarizeForDebug } from "@/lib/events";
import { MOCK_COMMENTS, MOCK_ENRICHMENTS, MOCK_TIMELINE } from "@/lib/mock-script";
import { base64ToPcm16, pcm16ToBase64 } from "@/lib/pcm";
import { buildSessionUpdate, readClientSecret, realtimeSocketUrl } from "@/lib/session-config";
import { createState, type AppState, type Enrichment, type FunctionCall, type RealtimeEvent, type SourceId, type VoiceId } from "@/lib/types";
import { MicCapture, PcmPlayer } from "@/realtime/audio";

const AUDIO_DELTA = new Set(["response.output_audio.delta", "response.audio.delta"]);

function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export function useSession(mock: boolean) {
  const [state, setState] = useState<AppState>(() =>
    createState({ debug: debugEnabled(), connection: mock ? "ready" : "idle" }),
  );
  const stateRef = useRef(state);
  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const holdingRef = useRef(false);
  const sentAudioRef = useRef(false);
  const roundsRef = useRef(0);
  const mockStopRef = useRef<(() => void) | null>(null);
  const [mockPlaying, setMockPlaying] = useState(false);
  const [connectId, setConnectId] = useState(0);

  const apply = useCallback((action: Parameters<typeof reduce>[1]) => {
    const next = reduce(stateRef.current, action);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const enrichUrls = useCallback(
    async (urls: string[]) => {
      try {
        const body = await postJson<{ enrichments: Enrichment[] }>("/api/enrich", { urls });
        apply({ type: "enrich", enrichments: body.enrichments ?? [] });
      } catch (error) {
        apply({
          type: "enrich",
          enrichments: urls.map((url) => ({
            url: canonicalUrl(url),
            source: sourceFromUrl(url),
            authorName: "Original post",
            handle: "",
            text: "",
            provider: "none" as const,
            ok: false,
          })),
        });
        apply({ type: "notice", notice: error instanceof Error ? error.message : "Could not load post previews." });
      }
    },
    [apply],
  );

  const runTools = useCallback(
    async (calls: FunctionCall[]) => {
      roundsRef.current += 1;
      if (roundsRef.current > 4) {
        apply({ type: "notice", notice: "Stopped after four tool rounds so this turn couldn't loop." });
        return;
      }
      const outputs: { callId: string; output: unknown }[] = [];
      for (const call of calls) {
        if (call.name !== "search_youtube_comments") continue;
        let query = "";
        try {
          const parsed = JSON.parse(call.arguments) as { query?: string };
          query = typeof parsed.query === "string" ? parsed.query : "";
        } catch {
          query = "";
        }
        try {
          const body = await postJson<{ comments: AppState["youtubeComments"]; for_model: unknown[] }>("/api/youtube", {
            query,
          });
          apply({ type: "youtube", comments: body.comments ?? [] });
          outputs.push({ callId: call.callId, output: { comments: body.for_model ?? [] } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "YouTube search failed.";
          apply({ type: "notice", notice: message });
          outputs.push({ callId: call.callId, output: { comments: [], error: message } });
        }
      }
      for (const call of calls) {
        if (call.name === "render_story") {
          apply({ type: "render_story", raw: call.arguments });
          outputs.push({ callId: call.callId, output: { ok: true } });
        } else if (call.name !== "search_youtube_comments") {
          outputs.push({ callId: call.callId, output: { error: `Unknown function ${call.name}.` } });
        }
      }
      const urls = urlsNeedingEnrichment(stateRef.current.cards, stateRef.current.enrichments);
      if (urls.length) {
        apply({ type: "enrich_start", urls });
        void enrichUrls(urls);
      }
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      for (const output of outputs) {
        socket.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: output.callId,
              output: JSON.stringify(output.output),
            },
          }),
        );
      }
      socket.send(JSON.stringify({ type: "response.create" }));
    },
    [apply, enrichUrls],
  );

  const onRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (stateRef.current.debug) {
        console.log("[talk-to-the-feed]", event.type, summarizeForDebug(event));
      }
      const next = apply({ type: "event", event });
      if (next.toolBatch?.length) {
        const calls = next.toolBatch;
        apply({ type: "consume_tools" });
        if (!mock) void runTools(calls);
      }
      if (!mock && AUDIO_DELTA.has(event.type) && typeof event.delta === "string") {
        playerRef.current?.enqueue(base64ToPcm16(event.delta));
      }
    },
    [apply, mock, runTools],
  );

  const onEventRef = useRef(onRealtimeEvent);
  onEventRef.current = onRealtimeEvent;

  useEffect(() => {
    playerRef.current = new PcmPlayer();
    return () => {
      playerRef.current?.stop();
      void micRef.current?.stop();
      mockStopRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (mock) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    const connect = async () => {
      apply({ type: "connection", connection: "connecting", error: null });
      try {
        const response = await fetch("/api/session", { method: "POST" });
        const body = (await response.json().catch(() => ({}))) as { error?: string; value?: string };
        if (cancelled) return;
        if (!response.ok) throw new Error(body.error || "Could not mint a client token.");
        const secret = readClientSecret(body);
        if (!secret) throw new Error("The session endpoint did not return a token.");
        socket = new WebSocket(realtimeSocketUrl(), [`xai-client-secret.${secret.value}`]);
        wsRef.current = socket;
        socket.addEventListener("open", () => {
          if (cancelled) return;
          apply({ type: "connection", connection: "ready", error: null });
        });
        socket.addEventListener("message", (message) => {
          if (typeof message.data !== "string") {
            if (stateRef.current.debug) console.log("[talk-to-the-feed]", "binary-frame");
            return;
          }
          try {
            onEventRef.current(JSON.parse(message.data) as RealtimeEvent);
          } catch (error) {
            if (stateRef.current.debug) console.log("[talk-to-the-feed]", "bad-json", error);
          }
        });
        socket.addEventListener("close", () => {
          if (cancelled) return;
          apply({
            type: "connection",
            connection: "closed",
            error: "The voice session closed. Reconnect to keep talking.",
          });
        });
        socket.addEventListener("error", () => {
          if (stateRef.current.debug) console.log("[talk-to-the-feed]", "websocket-error");
        });
      } catch (error) {
        if (cancelled) return;
        apply({
          type: "connection",
          connection: "closed",
          error: error instanceof Error ? error.message : "Could not connect.",
        });
      }
    };
    void connect();
    return () => {
      cancelled = true;
      socket?.close();
      if (wsRef.current === socket) wsRef.current = null;
    };
  }, [apply, mock, connectId]);

  useEffect(() => {
    if (mock || state.connection !== "ready") return;
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(buildSessionUpdate({ voice: state.voice, sources: state.sources })));
  }, [mock, state.connection, state.voice, state.sources]);

  const beginHold = useCallback(async () => {
    if (mock || holdingRef.current || stateRef.current.connection !== "ready") return;
    const phase = stateRef.current.phase;
    const socket = wsRef.current;
    playerRef.current?.stop();
    if (socket && socket.readyState === WebSocket.OPEN && (phase === "speaking" || phase === "thinking")) {
      socket.send(JSON.stringify({ type: "response.cancel" }));
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    }
    sentAudioRef.current = false;
    roundsRef.current = 0;
    holdingRef.current = true;
    apply({ type: "start_turn" });
    try {
      if (!micRef.current) {
        const mic = new MicCapture((pcm) => {
          if (!holdingRef.current) return;
          const current = wsRef.current;
          if (!current || current.readyState !== WebSocket.OPEN) return;
          sentAudioRef.current = true;
          current.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcm16ToBase64(pcm) }));
        });
        micRef.current = mic;
        await mic.start();
      }
      await micRef.current.resume();
      await playerRef.current?.resume();
    } catch (error) {
      holdingRef.current = false;
      apply({ type: "phase", phase: "idle" });
      apply({
        type: "notice",
        notice: error instanceof Error ? error.message : "Microphone permission is required to talk.",
      });
    }
  }, [apply, mock]);

  const endHold = useCallback(() => {
    if (mock || !holdingRef.current) return;
    holdingRef.current = false;
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      apply({ type: "phase", phase: "idle" });
      return;
    }
    if (!sentAudioRef.current) {
      socket.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      apply({ type: "phase", phase: "idle" });
      apply({ type: "notice", notice: "Hold the button a little longer so there's something to send." });
      return;
    }
    apply({ type: "phase", phase: "thinking" });
    socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    socket.send(JSON.stringify({ type: "response.create" }));
  }, [apply, mock]);

  const beginRef = useRef(beginHold);
  const endRef = useRef(endHold);
  beginRef.current = beginHold;
  endRef.current = endHold;

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || mock) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      void beginRef.current();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== "Space" || mock) return;
      endRef.current();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mock]);

  const playMock = useCallback(() => {
    mockStopRef.current?.();
    apply({ type: "start_turn" });
    apply({ type: "youtube", comments: MOCK_COMMENTS });
    apply({ type: "enrich", enrichments: MOCK_ENRICHMENTS });
    setMockPlaying(true);
    const timeline = MOCK_TIMELINE;
    let index = 0;
    let timer = 0;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
      window.clearTimeout(timer);
      setMockPlaying(false);
    };
    // Wait out each beat after the previous one is applied. A late timer must
    // not catch up, and a gap that failed to parse must not collapse to zero.
    const step = () => {
      if (cancelled) return;
      if (index >= timeline.length) {
        stop();
        return;
      }
      const raw = index === 0 ? timeline[0].at : timeline[index].at - timeline[index - 1].at;
      const gap = Number.isFinite(raw) && raw > 0 ? raw : 800;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        onEventRef.current(timeline[index].event);
        index += 1;
        step();
      }, gap);
    };
    mockStopRef.current = stop;
    step();
  }, [apply]);

  return {
    state,
    mockPlaying,
    setVoice: (voice: VoiceId) => apply({ type: "set_voice", voice }),
    setSource: (source: SourceId, enabled: boolean) => apply({ type: "set_source", source, enabled }),
    setDebug: (enabled: boolean) => apply({ type: "set_debug", enabled }),
    beginHold,
    endHold,
    playMock,
    reconnect: () => setConnectId((value) => value + 1),
  };
}
