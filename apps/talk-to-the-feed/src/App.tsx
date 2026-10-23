import { Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StoryPanel } from "@/components/StoryPanel";
import { Transcript } from "@/components/Transcript";
import { SOURCE_ORDER, VOICES, type SourceId } from "@/lib/types";
import { useSession } from "@/useSession";

const SOURCE_COPY: Record<SourceId, { label: string; note: string }> = {
  x: { label: "X", note: "Posts from the built-in x_search tool." },
  facebook: {
    label: "Facebook",
    note: "Public pages only. Facebook has no post search, so this is whatever web search can reach on facebook.com.",
  },
  youtube: { label: "YouTube", note: "Recent videos, then the top comments by relevance." },
};

function statusLabel(phase: string, connection: string, mock: boolean): string {
  if (mock) {
    if (phase === "listening") return "Listening";
    if (phase === "thinking") return "Checking the feed";
    if (phase === "speaking") return "Speaking";
    return "Mock ready";
  }
  if (connection === "connecting") return "Connecting";
  if (connection === "closed") return "Disconnected";
  if (phase === "listening") return "Listening";
  if (phase === "thinking") return "Checking the feed";
  if (phase === "speaking") return "Speaking";
  return "Ready";
}

export function App() {
  const mock = new URLSearchParams(window.location.search).get("mock") === "1";
  const session = useSession(mock);
  const { state } = session;
  const speaking = state.phase === "speaking";
  const listening = state.phase === "listening";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6" data-mock={mock ? "true" : "false"}>
        {mock ? (
          <div className="mb-4 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-center text-sm text-primary">
            Mock data. Scripted session, not live posts. The Orbit Sneakers story is fictional.
          </div>
        ) : null}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Talk to the Feed</p>
            <h1 className="mt-1 font-serif text-3xl tracking-tight">What are people saying?</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {speaking ? (
              <span className="flex h-4 items-end gap-0.5" aria-hidden>
                <span className="eq-bar inline-block h-4 w-0.5 bg-primary" />
                <span className="eq-bar inline-block h-4 w-0.5 bg-primary [animation-delay:120ms]" />
                <span className="eq-bar inline-block h-4 w-0.5 bg-primary [animation-delay:240ms]" />
              </span>
            ) : null}
            <span data-testid="status">{statusLabel(state.phase, state.connection, mock)}</span>
            <Badge variant="outline">grok-voice-3.0</Badge>
          </div>
        </header>
        {state.error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p>{state.error}</p>
            {mock ? null : (
              <Button variant="outline" size="sm" onClick={session.reconnect}>
                Reconnect
              </Button>
            )}
          </div>
        ) : null}
        {state.notice ? <p className="mb-4 text-sm text-muted-foreground">{state.notice}</p> : null}
        <div className="grid flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit p-5">
            <div className="space-y-3">
              {SOURCE_ORDER.map((source) => (
                <label key={source} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium">{SOURCE_COPY[source].label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{SOURCE_COPY[source].note}</span>
                  </span>
                  <Switch
                    checked={state.sources[source]}
                    onCheckedChange={(checked) => session.setSource(source, checked)}
                    aria-label={SOURCE_COPY[source].label}
                  />
                </label>
              ))}
            </div>
            <Separator className="my-5" />
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Voice</div>
            <div className="grid grid-cols-3 gap-2">
              {VOICES.map((voice) => (
                <Tooltip key={voice.id}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={state.voice === voice.id ? "default" : "outline"}
                      size="sm"
                      aria-pressed={state.voice === voice.id}
                      onClick={() => session.setVoice(voice.id)}
                    >
                      {voice.name}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{voice.tone}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Separator className="my-5" />
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Debug events
                <span className="mt-0.5 block text-xs text-muted-foreground">Logs realtime event types in the console.</span>
              </span>
              <Switch checked={state.debug} onCheckedChange={session.setDebug} aria-label="Debug events" />
            </label>
            <div className="mt-6 flex flex-col items-center">
              {mock ? (
                <Button type="button" size="lg" onClick={session.playMock} disabled={session.mockPlaying} data-testid="play-mock">
                  {session.mockPlaying ? "Playing the sample…" : state.story ? "Replay sample question" : "Play sample question"}
                </Button>
              ) : (
                <button
                  type="button"
                  data-testid="talk-button"
                  className="relative grid size-28 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                  disabled={state.connection !== "ready"}
                  aria-pressed={listening}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    void session.beginHold();
                  }}
                  onPointerUp={() => session.endHold()}
                  onPointerCancel={() => session.endHold()}
                >
                  {listening ? <span className="pulse-ring absolute inset-0 rounded-full border border-primary" /> : null}
                  <Mic className="size-8" />
                </button>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {mock
                  ? "Paced sample, about ten seconds. No microphone and no API key."
                  : "Hold to talk. Space works too. Release to send."}
              </p>
            </div>
            <Separator className="my-5" />
            <Transcript state={state} />
          </Card>
          <StoryPanel state={state} fictional={mock} />
        </div>
        <footer className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Grok Voice answers out loud. The browser only holds a short-lived client token. Facebook coverage is public pages and
          posts that web search can reach — there is no public post-search API.
        </footer>
      </div>
    </TooltipProvider>
  );
}
