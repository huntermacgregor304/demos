import type { ReactNode } from "react";

export function NoteView({ markdown, onOpen }: { markdown: string; onOpen: (id: string) => void }) {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n*/, "");
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={index} className="mt-4 font-mono text-sm text-cyan">{inline(line.slice(4), onOpen, index)}</h3>);
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={index} className="mt-5 font-mono text-base text-foreground">{inline(line.slice(3), onOpen, index)}</h2>);
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={index} className="font-mono text-xl tracking-wide text-foreground">{inline(line.slice(2), onOpen, index)}</h1>);
      index += 1;
      continue;
    }
    if (line.trim().startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith(">")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      const callout = quote[0]?.match(/^\[!([a-z]+)\]\s*(.*)$/i);
      const tone = callout?.[1]?.toLowerCase();
      const toneClass =
        tone === "warning" || tone === "failure"
          ? "border-magenta/50 bg-magenta/10"
          : tone === "success"
            ? "border-cyan/50 bg-cyan/10"
            : "border-border bg-muted/40";
      blocks.push(
        <blockquote key={`q-${index}`} className={`rounded-md border px-3 py-2 text-sm leading-relaxed ${toneClass}`}>
          {quote.slice(callout ? 1 : 0).map((part, partIndex) => (
            <p key={partIndex}>{inline(part, onOpen, partIndex)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test((lines[index] ?? "").trim())) {
        items.push((lines[index] ?? "").trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="flex flex-col gap-2 text-sm leading-relaxed">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className={itemClass(item)}>
              {inline(item, onOpen, itemIndex)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index] ?? "").trim() && !/^(#|>|[-*] )/.test((lines[index] ?? "").trim())) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed text-foreground/90">
        {inline(paragraph.join(" "), onOpen, index)}
      </p>,
    );
  }
  return <div className="flex flex-col gap-3">{blocks}</div>;
}

function itemClass(item: string): string {
  if (item.includes("**unverified**")) return "rounded-md border border-magenta/30 bg-magenta/10 px-2 py-1";
  if (item.includes("**sourced**")) return "rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1";
  return "";
}

function inline(text: string, onOpen: (id: string) => void, seed: number): ReactNode[] {
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|https?:\/\/[^\s)]+/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    if (match[1]) {
      const id = match[1].trim();
      parts.push(
        <button key={`${seed}-${key}`} type="button" className="text-cyan underline decoration-cyan/40 underline-offset-2" onClick={() => onOpen(id)}>
          {match[2] || id}
        </button>,
      );
    } else if (match[4]) {
      parts.push(
        <a key={`${seed}-${key}`} href={match[4]} target="_blank" rel="noreferrer" className="text-cyan underline decoration-cyan/40 underline-offset-2">
          {match[3]}
        </a>,
      );
    } else if (match[5]) {
      parts.push(<strong key={`${seed}-${key}`}>{match[5]}</strong>);
    } else if (match[6]) {
      parts.push(
        <code key={`${seed}-${key}`} className="rounded bg-muted px-1 font-mono text-[12px] text-cyan">
          {match[6]}
        </code>,
      );
    } else {
      parts.push(
        <a key={`${seed}-${key}`} href={match[0]} target="_blank" rel="noreferrer" className="break-all text-cyan underline decoration-cyan/40 underline-offset-2">
          {match[0]}
        </a>,
      );
    }
    last = start + match[0].length;
    key += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
