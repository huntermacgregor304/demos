import { useEffect, useRef, useState, type CSSProperties } from "react";
import { agents } from "@/data/agents";
import { DataMark } from "@/components/DataMark";
import { DeskScene, type Marker } from "@/components/DeskScene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { desk } from "@/lib/desk";
import { buildDebate, debateFacts, type DebateLine } from "@/lib/debate";

const rules = buildDebate(desk);

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function bubbleStyle(speaker: Marker, stage: HTMLDivElement | null): CSSProperties {
  const width = stage?.clientWidth ?? 900;
  const height = stage?.clientHeight ?? 520;
  const foreground = speaker.y > height * 0.58;
  return {
    left: clamp(speaker.x, 180, width - 180),
    top: speaker.y,
    transform: foreground ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 34px))",
  };
}

export function WarRoom({ active }: { active: boolean }) {
  const [lines, setLines] = useState<DebateLine[]>(rules);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [note, setNote] = useState("Rules script. Optional LLM rewrite stays on the server.");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const line = lines[index] ?? lines[0];
  const speaker = markers.find((marker) => marker.id === line.agentId);

  useEffect(() => {
    if (!active || paused) return;
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % lines.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, [active, paused, lines.length]);

  async function rewrite() {
    setNote("Asking the dev server…");
    try {
      const response = await fetch("/api/debate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: debateFacts(desk) }),
      });
      const body = (await response.json()) as {
        mode?: string;
        lines?: { agent?: string; text?: string }[];
        error?: string;
      };
      if (body.mode === "llm" && Array.isArray(body.lines) && body.lines.length > 0) {
        const next = body.lines.flatMap((item) => {
          const agent = agents.find((candidate) => candidate.name === item.agent?.toUpperCase());
          if (!agent || typeof item.text !== "string" || item.text.trim() === "") return [];
          return [{ agentId: agent.id, name: agent.name, role: agent.role, text: item.text.trim() }];
        });
        if (next.length === 0) {
          setNote("The model answered in a shape this desk does not use. Rules script stays.");
          return;
        }
        setLines(next);
        setIndex(0);
        setNote("LLM rewrite. Still a demo. The rules script is one click away.");
        return;
      }
      setNote("LLM mode is off. No NIGHT_DESK_LLM_API_KEY in the server environment. Rules script stays.");
    } catch {
      setNote("LLM rewrite did not answer. Rules script stays.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <DataMark historical demo />
          <p className="mt-2 max-w-xl text-xs text-muted-foreground">
            Closes in the lines are historical. The words are a demo script driven by those closes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume debate" : "Pause debate"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIndex((value) => (value + 1) % lines.length)}
          >
            Next line
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setLines(rules);
              setIndex(0);
              setNote("Rules script. Optional LLM rewrite stays on the server.");
            }}
          >
            Rules script
          </Button>
          <Button type="button" size="sm" onClick={() => void rewrite()}>
            LLM rewrite
          </Button>
        </div>
      </div>
      <div ref={stageRef} className="relative min-h-[420px] flex-1">
        <DeskScene activeId={line.agentId} onMarkers={setMarkers} />
        <div className="pointer-events-none absolute inset-0">
          {markers.map((marker) => {
            const agent = agents.find((item) => item.id === marker.id);
            if (!agent) return null;
            return (
              <div
                key={agent.id}
                className="absolute font-display text-[10px] tracking-[0.16em]"
                style={{ left: marker.x, top: marker.y, transform: "translate(-50%, -150%)", color: agent.color }}
              >
                {agent.name}
                <span className="mt-0.5 block text-center font-mono text-[9px] tracking-[0.14em] text-foreground/80">
                  {agent.role}
                </span>
              </div>
            );
          })}
          {speaker ? (
            <div
              className={`speech-bubble absolute w-[min(340px,46%)] rounded-2xl px-3 py-2 ${line.role === "bear" || line.role === "risk" ? "bear" : ""}`}
              style={bubbleStyle(speaker, stageRef.current)}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="font-display text-[11px] tracking-[0.14em] text-cyan">{line.name}</span>
                <Badge variant={line.role === "bear" ? "magenta" : "cyan"}>{line.role}</Badge>
              </div>
              <p className="text-[13px] leading-snug text-foreground">{line.text}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-cyan/25 bg-background/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm tracking-[0.14em] text-cyan">{line.name}</span>
          <Badge variant="outline">{line.role}</Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {index + 1} / {lines.length}
          </span>
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed">{line.text}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}
