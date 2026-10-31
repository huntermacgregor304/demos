import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { layoutGraph, type Point } from "@/graph/layout";
import { NoteView } from "@/graph/NoteView";
import { cn } from "@/lib/utils";
import type { ClaimStatus, GraphEdge, GraphNode, GraphSummary } from "@/types";

export type WikiGraphProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  notes?: Record<string, string>;
  summary?: GraphSummary;
  className?: string;
  title?: string;
  showReader?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
};

const FILTERS = ["all", "sourced", "unverified", "mixed"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_LABEL: Record<ClaimStatus, string> = {
  sourced: "sourced",
  unverified: "unverified",
  mixed: "mixed",
  none: "structural",
};

/**
 * Memory graph for a wiki vault.
 * Drop this into a HUD MEMORY panel: pass nodes and edges, and notes if the
 * panel should open a note on click. showReader can be turned off when the
 * host draws its own reader from onSelect.
 */
export function WikiGraph({
  nodes,
  edges,
  notes,
  summary,
  className,
  title = "Bot Brain",
  showReader = true,
  selectedId,
  onSelect,
}: WikiGraphProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positions = useRef<Record<string, Point>>({});
  const pan = useRef({ x: 0, y: 0 });
  const zoom = useRef(1);
  const selectedRef = useRef<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const drag = useRef<{ kind: "pan" | "node"; id?: string; x: number; y: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [internalId, setInternalId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const selected = selectedId !== undefined ? selectedId : internalId;
  selectedRef.current = selected;

  const nodeKey = nodes.map((node) => `${node.id}:${node.claimStatus}`).join("|");
  const visible = useMemo(() => new Set(nodes.filter((node) => matches(node, filter, query)).map((node) => node.id)), [nodes, filter, query]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      const rect = stage.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    positions.current = layoutGraph(nodes, edges, size.width, size.height);
  }, [nodeKey, size.width, size.height, nodes, edges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const draw = (time: number) => {
      const context = canvas.getContext("2d");
      if (!context) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(size.width * ratio);
      canvas.height = Math.floor(size.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint(context, {
        nodes,
        edges,
        positions: positions.current,
        width: size.width,
        height: size.height,
        pan: pan.current,
        zoom: zoom.current,
        visible,
        hoverId: hoverRef.current,
        selectedId: selectedRef.current,
        time,
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [nodes, edges, size.width, size.height, visible]);

  const choose = (id: string | null) => {
    onSelect?.(id);
    if (selectedId === undefined) setInternalId(id);
  };

  const world = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.current.x) / zoom.current,
      y: (clientY - rect.top - pan.current.y) / zoom.current,
    };
  };

  const hit = (clientX: number, clientY: number) => {
    const point = world(clientX, clientY);
    let found: string | null = null;
    for (const node of nodes) {
      if (!visible.has(node.id)) continue;
      const at = positions.current[node.id];
      if (!at) continue;
      const dx = point.x - at.x;
      const dy = point.y - at.y;
      if (dx * dx + dy * dy <= 24 * 24) found = node.id;
    }
    return found;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const next = clamp(zoom.current * (event.deltaY > 0 ? 0.92 : 1.08), 0.45, 2.6);
      const scale = next / zoom.current;
      pan.current = {
        x: mouseX - (mouseX - pan.current.x) * scale,
        y: mouseY - (mouseY - pan.current.y) * scale,
      };
      zoom.current = next;
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const selectedNode = nodes.find((node) => node.id === selected) ?? null;

  return (
    <div className={cn("brain-shell flex h-full min-h-0 flex-col text-foreground", className)}>
      <header className="flex flex-wrap items-center gap-3 border-b border-cyan/20 px-4 py-3">
        <div className="min-w-40">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan">Memory</p>
          <h1 className="bg-gradient-to-r from-cyan to-magenta bg-clip-text font-mono text-lg font-semibold tracking-[0.18em] text-transparent">
            {title}
          </h1>
        </div>
        <Separator orientation="vertical" className="hidden h-8 sm:block" />
        <p className="font-mono text-xs text-muted-foreground">
          {summary ? `${summary.notes} notes · ${summary.sourced} sourced · ${summary.unverified} unverified` : `${nodes.length} notes`}
          {summary?.fixtures ? " · sample fixtures" : ""}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="w-40 border-cyan/30"
          />
          {FILTERS.map((item) => (
            <Button key={item} size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)}>
              {item === "all" ? "All" : item[0]!.toUpperCase() + item.slice(1)}
            </Button>
          ))}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="max-h-40 overflow-auto border-b border-cyan/15 p-3 md:max-h-none md:w-64 md:border-b-0 md:border-r">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Notes</p>
          <div className="flex flex-col gap-1">
            {nodes.filter((node) => visible.has(node.id)).map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => choose(node.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  selected === node.id && "bg-accent",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: swatch(node.claimStatus), boxShadow: `0 0 8px ${swatch(node.claimStatus)}` }} />
                <span className="truncate">{node.title}</span>
              </button>
            ))}
          </div>
        </aside>
        <div ref={stageRef} className="relative min-h-[420px] min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none"
            aria-label="Wiki graph"
            onPointerDown={(event) => {
              const id = hit(event.clientX, event.clientY);
              drag.current = { kind: id ? "node" : "pan", id: id ?? undefined, x: event.clientX, y: event.clientY, moved: false };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const id = hit(event.clientX, event.clientY);
              hoverRef.current = id;
              const rect = canvasRef.current?.getBoundingClientRect();
              setHover(id && rect ? { id, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
              const active = drag.current;
              if (!active) return;
              const dx = event.clientX - active.x;
              const dy = event.clientY - active.y;
              if (Math.abs(dx) + Math.abs(dy) > 3) active.moved = true;
              active.x = event.clientX;
              active.y = event.clientY;
              if (active.kind === "pan") {
                pan.current = { x: pan.current.x + dx, y: pan.current.y + dy };
              } else if (active.id && positions.current[active.id]) {
                const point = positions.current[active.id]!;
                point.x += dx / zoom.current;
                point.y += dy / zoom.current;
              }
            }}
            onPointerUp={() => {
              const active = drag.current;
              drag.current = null;
              if (!active || active.moved) return;
              choose(active.kind === "node" ? active.id ?? null : null);
            }}
            onDoubleClick={() => {
              pan.current = { x: 0, y: 0 };
              zoom.current = 1;
            }}
          />
          {hover && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-cyan/40 bg-[#0B0F19]/90 px-2 py-1 font-mono text-xs shadow-[0_0_16px_rgba(62,240,255,0.35)]"
              style={{ left: hover.x + 14, top: hover.y + 14 }}
            >
              <div>{nodes.find((node) => node.id === hover.id)?.title}</div>
              <div className="text-magenta">{STATUS_LABEL[nodes.find((node) => node.id === hover.id)?.claimStatus ?? "none"]}</div>
            </div>
          )}
          <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Scroll zoom · drag pan · click a node
          </p>
          {showReader && selectedNode && (
            <Card className="absolute top-3 right-3 bottom-3 flex w-[min(420px,calc(100%-1.5rem))] flex-col overflow-hidden border-cyan/40 shadow-[0_0_32px_rgba(255,43,214,0.18)]">
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{selectedNode.group}</p>
                  <CardTitle className="mt-1 text-lg">{selectedNode.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badgeVariant(selectedNode.claimStatus)}>{STATUS_LABEL[selectedNode.claimStatus]}</Badge>
                  <Button size="sm" variant="outline" onClick={() => choose(null)} aria-label="Close note">
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto">
                {notes?.[selectedNode.id] ? (
                  <NoteView markdown={notes[selectedNode.id] ?? ""} onOpen={(id) => choose(id)} />
                ) : (
                  <p className="text-sm text-muted-foreground">No note body was passed for this node.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function matches(node: GraphNode, filter: Filter, query: string): boolean {
  if (filter !== "all" && node.claimStatus !== filter) return false;
  if (!query.trim()) return true;
  return node.title.toLowerCase().includes(query.trim().toLowerCase());
}

function swatch(status: ClaimStatus): string {
  if (status === "sourced") return "#3EF0FF";
  if (status === "unverified") return "#FF2BD6";
  if (status === "mixed") return "#FF7AE2";
  return "#8EA0C2";
}

function badgeVariant(status: ClaimStatus): "sourced" | "unverified" | "mixed" | "quiet" {
  if (status === "sourced" || status === "unverified" || status === "mixed") return status;
  return "quiet";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function paint(
  context: CanvasRenderingContext2D,
  scene: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    positions: Record<string, Point>;
    width: number;
    height: number;
    pan: Point;
    zoom: number;
    visible: Set<string>;
    hoverId: string | null;
    selectedId: string | null;
    time: number;
  },
) {
  const { width, height } = scene;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#0B0F19";
  context.fillRect(0, 0, width, height);
  const glowA = context.createRadialGradient(width * 0.15, height * 0.1, 20, width * 0.15, height * 0.1, width * 0.55);
  glowA.addColorStop(0, "rgba(62, 240, 255, 0.16)");
  glowA.addColorStop(1, "rgba(62, 240, 255, 0)");
  context.fillStyle = glowA;
  context.fillRect(0, 0, width, height);
  const glowB = context.createRadialGradient(width * 0.9, height * 0.95, 10, width * 0.9, height * 0.95, width * 0.5);
  glowB.addColorStop(0, "rgba(255, 43, 214, 0.16)");
  glowB.addColorStop(1, "rgba(255, 43, 214, 0)");
  context.fillStyle = glowB;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(scene.pan.x, scene.pan.y);
  context.scale(scene.zoom, scene.zoom);

  for (const edge of scene.edges) {
    const a = scene.positions[edge.source];
    const b = scene.positions[edge.target];
    if (!a || !b) continue;
    const hot = scene.visible.has(edge.source) && scene.visible.has(edge.target);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.strokeStyle = hot ? "rgba(62, 240, 255, 0.45)" : "rgba(62, 240, 255, 0.08)";
    context.lineWidth = hot ? 1.4 : 1;
    context.stroke();
  }

  const placed: { x: number; y: number; w: number; h: number }[] = [];
  for (const node of scene.nodes) {
    const point = scene.positions[node.id];
    if (!point) continue;
    const on = scene.visible.has(node.id);
    const color = swatch(node.claimStatus);
    const pulse = 1 + Math.sin(scene.time / 420 + point.x) * 0.06;
    const radius = (node.id === scene.selectedId ? 16 : 13) * pulse;
    context.save();
    context.globalAlpha = on ? 1 : 0.12;
    context.shadowColor = color;
    context.shadowBlur = node.id === scene.hoverId || node.id === scene.selectedId ? 28 : 16;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = node.claimStatus === "mixed" ? "#FF2BD6" : color;
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = node.claimStatus === "mixed" ? 3 : 1.5;
    context.strokeStyle = node.claimStatus === "mixed" ? "#3EF0FF" : "#F4FEFF";
    context.stroke();
    if (node.id === scene.selectedId) {
      context.beginPath();
      context.arc(point.x, point.y, radius + 8, scene.time / 300, scene.time / 300 + 4);
      context.strokeStyle = "#3EF0FF";
      context.lineWidth = 1.5;
      context.stroke();
    }
    const label = trim(node.title, 22);
    context.font = "12px 'IBM Plex Mono', ui-monospace, monospace";
    const widthPx = context.measureText(label).width;
    const spot = placeLabel(placed, point.x, point.y, radius, widthPx);
    context.textAlign = "left";
    context.fillStyle = "#E7FBFF";
    context.fillText(label, spot.x, spot.y);
    placed.push({ x: spot.x, y: spot.y - 12, w: widthPx, h: 16 });
    context.restore();
  }
  context.restore();
}

function placeLabel(
  placed: { x: number; y: number; w: number; h: number }[],
  cx: number,
  cy: number,
  radius: number,
  widthPx: number,
) {
  const options = [
    { x: cx - widthPx / 2, y: cy + radius + 16 },
    { x: cx - widthPx / 2, y: cy - radius - 8 },
    { x: cx + radius + 8, y: cy + 4 },
    { x: cx - radius - widthPx - 8, y: cy + 4 },
    { x: cx - widthPx / 2, y: cy + radius + 32 },
  ];
  let best = options[0]!;
  let bestHits = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const box = { x: option.x, y: option.y - 12, w: widthPx, h: 16 };
    const hits = placed.filter((other) => intersects(box, other)).length;
    if (hits < bestHits) {
      best = option;
      bestHits = hits;
      if (hits === 0) break;
    }
  }
  return best;
}

function intersects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function trim(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
