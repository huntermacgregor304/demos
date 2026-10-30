import { useRef, useState } from "react";
import { SpaceCanvas } from "@/components/space/SpaceCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  displayName,
  getBot,
  relationshipLines,
  statusLabel,
  type Bot,
  type BotStatus,
} from "@/data/bots";
import {
  SCENE,
  groupStyle,
  handoffRoute,
  orbitRadii,
  nameLabels,
  orbs,
  type OrbPlacement,
  type PulseId,
} from "@/lib/constellation";
import { useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const statusVariant: Record<BotStatus, "mint" | "coral" | "ice" | "brass" | "violet" | "outline"> = {
  "on-duty": "mint",
  building: "coral",
  scouting: "ice",
  advising: "brass",
  standby: "outline",
  loop: "violet",
};

export function Constellation() {
  const reduced = useReducedMotion();
  const [selectedId, setSelectedId] = useState("builder");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pulse, setPulse] = useState<PulseId>("talk-to-the-feed");
  const selected = getBot(selectedId);
  const route = handoffRoute(pulse);
  const hovered = hoverId ? orbs.find((orb) => orb.id === hoverId) : undefined;
  const svgRef = useRef<SVGSVGElement>(null);
  const mouse = useRef({ x: 0, y: 0 });

  return (
    <div
      className="relative h-full min-h-[640px]"
      onMouseMove={(event) => {
        if (reduced) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        mouse.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        mouse.current.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      }}
    >
      <SpaceCanvas svgRef={svgRef} reduced={reduced} mouse={mouse} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
        className="absolute inset-0 z-[1] h-full w-full"
        role="group"
        aria-label="Bot constellation"
      >
        <defs>
          <linearGradient id="iris" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff1b8" />
            <stop offset="22%" stopColor="#7ee0ff" />
            <stop offset="48%" stopColor="#f3b6ff" />
            <stop offset="72%" stopColor="#7dffb0" />
            <stop offset="100%" stopColor="#ffe08a" />
          </linearGradient>
          {Object.entries(groupStyle).map(([id, style]) => (
            <radialGradient key={id} id={`core-${id}`} cx="34%" cy="30%" r="72%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="28%" stopColor={style.core} />
              <stop offset="62%" stopColor={style.mid} />
              <stop offset="100%" stopColor="#140c22" />
            </radialGradient>
          ))}
        </defs>

        <Frame />
        <Geometry reduced={reduced} />
        <Earth />
        <HandoffPulse route={route} reduced={reduced} />

        {orbs.map((orb) => (
          <OrbNode
            key={orb.id}
            orb={orb}
            selected={orb.id === selectedId}
            onSelect={setSelectedId}
            onHover={setHoverId}
          />
        ))}
        {nameLabels.map((label) => {
          const orb = orbs.find((item) => item.id === label.id);
          if (!orb) return null;
          return (
            <text
              key={label.id}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              dominantBaseline="middle"
              fill="#f6edd4"
              stroke="#120818"
              strokeWidth="3.5"
              paintOrder="stroke"
              fontFamily="Figtree, sans-serif"
              fontSize="12"
              pointerEvents="none"
            >
              {orb.name}
            </text>
          );
        })}
        {hovered ? <OrbTip orb={hovered} /> : null}
      </svg>

      <aside className="glass-panel absolute inset-x-3 bottom-3 z-10 max-h-[46%] overflow-auto rounded-xl p-4 lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-4 lg:max-h-[calc(100%-2rem)] lg:w-[300px]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Handoff pulse</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={pulse === "talk-to-the-feed" ? "default" : "outline"}
            data-testid="pulse-feed"
            onClick={() => setPulse("talk-to-the-feed")}
          >
            Talk to the Feed
          </Button>
          <Button
            type="button"
            size="sm"
            variant={pulse === "bot-hq" ? "default" : "outline"}
            data-testid="pulse-hq"
            onClick={() => setPulse("bot-hq")}
          >
            Bot HQ
          </Button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Light runs scout, Hunter, Builder, then {route.marker === "shipped" ? "shipped." : "the build still in motion."}{" "}
          {route.label}.
        </p>
        <Separator className="my-3 bg-brass/30" />
        <Dossier bot={selected} />
        <Separator className="my-3 bg-brass/30" />
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(groupStyle).map(([id, style]) => (
            <li key={id} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: style.mid, boxShadow: `0 0 8px ${style.glow}` }} />
              {style.label}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Frame() {
  const { width, height } = SCENE;
  return (
    <g fill="none" stroke="#e7c98a" pointerEvents="none">
      <rect x="18" y="18" width={width - 36} height={height - 36} strokeWidth="1.15" />
      <rect x="28" y="28" width={width - 56} height={height - 56} strokeWidth="0.45" opacity="0.75" />
      <Corner x={18} y={18} sx={1} sy={1} />
      <Corner x={width - 18} y={18} sx={-1} sy={1} />
      <Corner x={18} y={height - 18} sx={1} sy={-1} />
      <Corner x={width - 18} y={height - 18} sx={-1} sy={-1} />
      <path d={`M ${width / 2 - 14} 18 l 14 -8 l 14 8`} strokeWidth="0.8" />
      <path d={`M ${width / 2 - 14} ${height - 18} l 14 8 l 14 -8`} strokeWidth="0.8" />
    </g>
  );
}

function Corner({ x, y, sx, sy }: { x: number; y: number; sx: 1 | -1; sy: 1 | -1 }) {
  return (
    <g stroke="#e7c98a" fill="none">
      <path d={`M ${x} ${y + sy * 42} L ${x} ${y} L ${x + sx * 42} ${y}`} strokeWidth="1.15" />
      <path d={`M ${x + sx * 10} ${y + sy * 30} L ${x + sx * 10} ${y + sy * 10} L ${x + sx * 30} ${y + sy * 10}`} strokeWidth="0.6" opacity="0.8" />
      <circle cx={x + sx * 20} cy={y + sy * 20} r="3.2" strokeWidth="0.9" />
      <circle cx={x + sx * 20} cy={y + sy * 20} r="7.5" strokeWidth="0.5" opacity="0.8" />
    </g>
  );
}

function Geometry({ reduced }: { reduced: boolean }) {
  const { cx, cy } = SCENE;
  return (
    <g pointerEvents="none">
      <line x1={cx} y1={46} x2={cx} y2={SCENE.height - 46} stroke="#e7c98a" strokeWidth="0.55" opacity="0.4" />
      <line x1={70} y1={cy} x2={860} y2={cy} stroke="#e7c98a" strokeWidth="0.4" opacity="0.28" />
      <circle cx={cx} cy={64} r="4" fill="none" stroke="#e7c98a" strokeWidth="0.8" />
      <circle cx={cx} cy={SCENE.height - 64} r="4" fill="none" stroke="#e7c98a" strokeWidth="0.8" />
      {orbitRadii.map((radius) => (
        <circle key={radius} cx={cx} cy={cy} r={radius} fill="none" stroke="#e7c98a" strokeWidth="0.7" opacity="0.32" />
      ))}
      <rect
        x={cx - 108}
        y={cy - 108}
        width={216}
        height={216}
        fill="none"
        stroke="#e7c98a"
        strokeWidth="0.6"
        opacity="0.4"
        transform={`rotate(45 ${cx} ${cy})`}
      />
      <circle cx={cx} cy={cy} r={292} fill="none" stroke="#e7c98a" strokeWidth="0.8" strokeDasharray="10 18" opacity="0.45">
        {!reduced ? <animate attributeName="stroke-dashoffset" from="0" to="-168" dur="22s" repeatCount="indefinite" /> : null}
      </circle>
    </g>
  );
}

function Earth() {
  const { cx, cy, earthR } = SCENE;
  return (
    <g data-testid="earth" aria-label="Hunter">
      <text x={cx} y={cy + earthR + 22} textAnchor="middle" fill="#f0d78c" fontFamily="Fraunces, serif" fontSize="16">
        Hunter
      </text>
    </g>
  );
}

function HandoffPulse({
  route,
  reduced,
}: {
  route: ReturnType<typeof handoffRoute>;
  reduced: boolean;
}) {
  return (
    <g pointerEvents="none" data-testid="handoff-pulse">
      <path d={route.path} fill="none" stroke="url(#iris)" strokeWidth="5" strokeLinecap="round" opacity="0.28" />
      <path d={route.path} fill="none" stroke="#fff6d0" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
      {reduced ? (
        <circle cx={route.end.x} cy={route.end.y} r="5" fill="#fff6d0" />
      ) : (
        <>
          <circle r="10" fill="#f0c56a" opacity="0.28">
            <animateMotion dur="8s" repeatCount="indefinite" path={route.path} />
          </circle>
          <circle r="3.4" fill="#fffaf0">
            <animateMotion dur="8s" repeatCount="indefinite" path={route.path} />
          </circle>
          <circle r="8" fill="#7ee0ff" opacity="0.22">
            <animateMotion dur="8s" begin="-4s" repeatCount="indefinite" path={route.path} />
          </circle>
          <circle r="2.6" fill="#ffffff">
            <animateMotion dur="8s" begin="-4s" repeatCount="indefinite" path={route.path} />
          </circle>
        </>
      )}
      <g transform={`translate(${route.end.x} ${route.end.y})`}>
        <circle r="16" fill="none" stroke={route.marker === "shipped" ? "#f0d78c" : "#ff8f70"} strokeWidth="1.1" />
        <text y="32" textAnchor="middle" fill={route.marker === "shipped" ? "#f0d78c" : "#ffb199"} fontFamily="IBM Plex Mono, monospace" fontSize="11">
          {route.label}
        </text>
      </g>
    </g>
  );
}

function OrbNode({
  orb,
  selected,
  onSelect,
  onHover,
}: {
  orb: OrbPlacement;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <g
      className={cn("orb-node", selected && "orb-selected")}
      data-bot-id={orb.id}
      data-selected={selected ? "true" : "false"}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`${orb.name}. ${orb.job}`}
      transform={`translate(${orb.x} ${orb.y})`}
      onClick={() => onSelect(orb.id)}
      onMouseEnter={() => onHover(orb.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(orb.id)}
      onBlur={() => onHover(null)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(orb.id);
        }
      }}
    >
      <circle className="orb-glow" r="26" fill={groupStyle[orb.group].glow} opacity="0.18" />
      <circle className="spin-ring" r="23" fill="none" stroke="#f0d78c" strokeWidth={selected ? 1.6 : 1.05} strokeDasharray={selected ? "5 7" : undefined} />
      <circle r="17.5" fill="none" stroke="#f0d78c" strokeWidth="0.55" opacity="0.8" />
      <circle r="12" fill={`url(#core-${orb.group})`} />
      <circle cx="-3.5" cy="-4" r="3.2" fill="#ffffff" opacity="0.55" />
    </g>
  );
}

function OrbTip({ orb }: { orb: OrbPlacement }) {
  const width = Math.min(210, 28 + orb.job.length * 5.6);
  const flipX = orb.x > SCENE.cx + 40;
  const flipY = orb.y > SCENE.cy;
  const x = flipX ? orb.x - width - 18 : orb.x + 22;
  const y = flipY ? orb.y - 58 : orb.y + 18;
  return (
    <g className="orb-tip" transform={`translate(${x} ${y})`} pointerEvents="none">
      <rect width={width} height="46" rx="8" fill="rgba(10, 8, 20, 0.88)" stroke="#e7c98a" strokeWidth="0.8" />
      <text x="10" y="18" fill="#f0d78c" fontFamily="Figtree, sans-serif" fontSize="12">
        {orb.name}
      </text>
      <text x="10" y="34" fill="#e7eef6" fontFamily="Figtree, sans-serif" fontSize="11">
        {orb.job.length > 42 ? `${orb.job.slice(0, 40)}…` : orb.job}
      </text>
    </g>
  );
}

function Dossier({ bot }: { bot: Bot }) {
  return (
    <div aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-2xl leading-none">{displayName(bot)}</h2>
        <Badge variant={statusVariant[bot.status]}>{statusLabel[bot.status]}</Badge>
        {bot.advisesOnly ? <Badge variant="brass">Advises only</Badge> : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed">{bot.job}</p>
      <div className="mt-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Standing order</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{bot.standingOrder}</p>
      </div>
      <div className="mt-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">On the chart</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{relationshipLines(bot).join(" ")}</p>
      </div>
      <div className="mt-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sample now</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{bot.now ?? "No sample assignment on this tape."}</p>
      </div>
    </div>
  );
}
