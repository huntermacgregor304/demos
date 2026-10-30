import { bots } from "@/data/bots";

export const SCENE = {
  width: 1200,
  height: 920,
  cx: 540,
  cy: 460,
  earthR: 78,
} as const;

export type OrbGroup = "personal" | "crypto" | "media" | "builders" | "loop";

export const groupStyle: Record<OrbGroup, { label: string; core: string; mid: string; glow: string }> = {
  personal: { label: "Personal", core: "#f4f1ff", mid: "#c9d4ff", glow: "#e7ecff" },
  crypto: { label: "Crypto", core: "#ffe0b0", mid: "#ffb15a", glow: "#ffd7a1" },
  media: { label: "Media", core: "#e9ffe9", mid: "#5dff9a", glow: "#c8ffd9" },
  builders: { label: "Builders / scouts", core: "#e7f8ff", mid: "#7ec8ff", glow: "#d5f3ff" },
  loop: { label: "Loop", core: "#f3e9ff", mid: "#c9a6ff", glow: "#eadfff" },
};

export type OrbPlacement = {
  id: string;
  name: string;
  job: string;
  group: OrbGroup;
  x: number;
  y: number;
  ring: number;
};

type RingSpec = {
  group: OrbGroup;
  ids: string[];
  radius: number;
  start: number;
  step: number;
};

const rings: RingSpec[] = [
  { group: "personal", ids: ["goku", "queen", "cosmic-sage", "import-bot", "steve"], radius: 168, start: -90, step: 72 },
  { group: "loop", ids: ["tanner", "dude", "kyle"], radius: 242, start: -30, step: 120 },
  { group: "builders", ids: ["demosx", "builder", "the-wire", "the-scout", "kal"], radius: 312, start: -60, step: 72 },
  {
    group: "media",
    ids: ["yt-master", "clip-editor", "aurixecho", "ufc-advisor"],
    radius: 378,
    start: -160,
    step: 40,
  },
  {
    group: "crypto",
    ids: ["king-satoshi", "king-jr", "satoshi-quant", "satoshi-scout", "nova"],
    radius: 378,
    start: 0,
    step: 40,
  },
];

function polar(radius: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: SCENE.cx + radius * Math.cos(radians),
    y: SCENE.cy + radius * Math.sin(radians),
  };
}

function placeRing(ring: RingSpec, index: number): OrbPlacement[] {
  return ring.ids.map((id, slot) => {
    const bot = bots.find((item) => item.id === id);
    if (!bot) throw new Error(`constellation missing bot ${id}`);
    const point = polar(ring.radius, ring.start + slot * ring.step);
    return {
      id,
      name: bot.name,
      job: bot.job,
      group: ring.group,
      x: point.x,
      y: point.y,
      ring: index,
    };
  });
}

export const orbs: OrbPlacement[] = rings.flatMap(placeRing);

export function orbById(id: string): OrbPlacement {
  const orb = orbs.find((item) => item.id === id);
  if (!orb) throw new Error(`no orb for ${id}`);
  return orb;
}

export function minSeparation(points: readonly { x: number; y: number }[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (distance < min) min = distance;
    }
  }
  return min;
}

export type PulseId = "talk-to-the-feed" | "bot-hq";

export type HandoffRoute = {
  path: string;
  end: { x: number; y: number };
  label: string;
  marker: "shipped" | "building";
};

function beyond(from: { x: number; y: number }, to: { x: number; y: number }, distance: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: to.x + (dx / length) * distance, y: to.y + (dy / length) * distance };
}

export function handoffRoute(pulse: PulseId): HandoffRoute {
  const scout = orbById("demosx");
  const builder = orbById("builder");
  const earth = { x: SCENE.cx, y: SCENE.cy };
  const shipped = pulse === "talk-to-the-feed";
  const end = beyond(earth, builder, shipped ? 70 : 52);
  const points = [scout, earth, builder, end];
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  return {
    path,
    end,
    label: shipped ? "PR #1" : "Building",
    marker: shipped ? "shipped" : "building",
  };
}

function lemniscate(scale: number, rotation: number): string {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  let path = "";
  const samples = 180;
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const den = 1 + Math.sin(t) ** 2;
    const x0 = (scale * Math.cos(t)) / den;
    const y0 = (scale * Math.sin(t) * Math.cos(t)) / den;
    const x = SCENE.cx + x0 * cos - y0 * sin;
    const y = SCENE.cy + x0 * sin + y0 * cos;
    path += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return path.trim();
}

function swirl(radius: number, wobble: number, rotation: number, lobes: number): string {
  let path = "";
  const samples = 220;
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const r = radius + wobble * Math.sin(lobes * t);
    const a = t + rotation;
    const x = SCENE.cx + r * Math.cos(a);
    const y = SCENE.cy + r * Math.sin(a);
    path += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${path.trim()} Z`;
}

export const ribbons = [
  lemniscate(210, 0.4),
  lemniscate(250, 2.1),
  swirl(200, 58, 0.6, 3),
  swirl(268, 46, 2.4, 2),
];

export const orbitRadii = [168, 242, 312, 378] as const;

export type NameLabel = {
  id: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
};

function defaultLabel(orb: OrbPlacement): NameLabel {
  const angle = Math.atan2(orb.y - SCENE.cy, orb.x - SCENE.cx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (cos > 0.5 && orb.x + 30 + orb.name.length * 6.4 < 1060) {
    return { id: orb.id, x: orb.x + 26, y: orb.y + 4, anchor: "start" };
  }
  if (cos < -0.5) {
    return { id: orb.id, x: orb.x - 26, y: orb.y + 4, anchor: "end" };
  }
  if (sin > 0) return { id: orb.id, x: orb.x, y: orb.y + 38, anchor: "middle" };
  return { id: orb.id, x: orb.x, y: orb.y - 34, anchor: "middle" };
}

export const nameLabels: NameLabel[] = orbs.map(defaultLabel);

function labelBox(label: NameLabel, name: string) {
  const width = name.length * 8.2;
  const left = label.anchor === "start" ? label.x : label.anchor === "end" ? label.x - width : label.x - width / 2;
  return { left, right: left + width, top: label.y - 9, bottom: label.y + 9 };
}

function boxesOverlap(a: ReturnType<typeof labelBox>, b: ReturnType<typeof labelBox>): boolean {
  return a.left < b.right + 14 && a.right + 14 > b.left && a.top < b.bottom + 8 && a.bottom + 8 > b.top;
}

for (let pass = 0; pass < 12; pass += 1) {
  for (let i = 0; i < nameLabels.length; i += 1) {
    for (let j = i + 1; j < nameLabels.length; j += 1) {
      const left = labelBox(nameLabels[i], orbs[i].name);
      const right = labelBox(nameLabels[j], orbs[j].name);
      if (!boxesOverlap(left, right)) continue;
      const orb = orbs[j];
      const angle = Math.atan2(orb.y - SCENE.cy, orb.x - SCENE.cx) + Math.PI / 2;
      nameLabels[j].x += Math.cos(angle) * 20;
      nameLabels[j].y += Math.sin(angle) * 20;
    }
  }
}

export function labelBoxesClear(): boolean {
  for (let i = 0; i < nameLabels.length; i += 1) {
    for (let j = i + 1; j < nameLabels.length; j += 1) {
      if (boxesOverlap(labelBox(nameLabels[i], orbs[i].name), labelBox(nameLabels[j], orbs[j].name))) return false;
    }
  }
  return true;
}
