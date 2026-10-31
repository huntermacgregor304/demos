import type { GraphEdge, GraphNode } from "@/types";

export type Point = { x: number; y: number };

export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): Record<string, Point> {
  const ordered = [...nodes].sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  const cx = width / 2;
  const cy = height / 2;
  const ring = Math.max(120, Math.min(width, height) * 0.42);
  ordered.forEach((node, index) => {
    const angle = (index / Math.max(1, ordered.length)) * Math.PI * 2 - Math.PI / 2;
    pos.set(node.id, {
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring,
      vx: 0,
      vy: 0,
    });
  });
  const links = edges.filter((edge) => pos.has(edge.source) && pos.has(edge.target) && edge.source !== edge.target);
  for (let iter = 0; iter < 160; iter += 1) {
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const a = pos.get(ordered[i]!.id)!;
        const b = pos.get(ordered[j]!.id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = 9800 / (dist * dist);
        dx /= dist;
        dy /= dist;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }
    }
    for (const edge of links) {
      const a = pos.get(edge.source)!;
      const b = pos.get(edge.target)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 210) * 0.02;
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }
    for (const node of ordered) {
      const point = pos.get(node.id)!;
      point.vx += (cx - point.x) * 0.006;
      point.vy += (cy - point.y) * 0.006;
      point.vx *= 0.72;
      point.vy *= 0.72;
      point.x = clamp(point.x + point.vx, 36, width - 36);
      point.y = clamp(point.y + point.vy, 28, height - 28);
    }
  }
  return Object.fromEntries([...pos.entries()].map(([id, point]) => [id, { x: point.x, y: point.y }]));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
