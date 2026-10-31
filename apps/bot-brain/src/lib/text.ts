export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function stripObsidianComments(markdown: string): string {
  return markdown.replace(/%%[\s\S]*?%%/g, "");
}

export function wikilinks(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  for (const match of text.matchAll(re)) {
    const target = match[1]?.trim();
    if (target) out.push(target);
  }
  return out;
}

export function safeTitle(title: string): string {
  return title.replace(/[\\/:#|[\]?]+/g, " ").replace(/\s+/g, " ").trim();
}

const STOP = new Set([
  "that",
  "this",
  "with",
  "from",
  "they",
  "them",
  "your",
  "into",
  "have",
  "were",
  "when",
  "will",
  "what",
  "about",
  "their",
  "there",
  "these",
  "those",
  "keep",
  "stay",
  "next",
  "week",
  "only",
  "does",
  "each",
]);

function stem(word: string): string {
  let value = word;
  if (value.endsWith("ing") && value.length > 6) value = value.slice(0, -3);
  else if (value.endsWith("ed") && value.length > 5) value = value.slice(0, -2);
  else if (value.endsWith("s") && !value.endsWith("ss") && value.length > 4) value = value.slice(0, -1);
  return value;
}

export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9+#]+/)
    .map(stem)
    .filter((word) => word.length >= 4 && !STOP.has(word));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export type Citation = { kind: "url"; url: string } | { kind: "note"; note: string };

export function stripSourceClause(text: string): { statement: string; citations: Citation[] } {
  const citations: Citation[] = [];
  const sourceTail = text.match(/\s+(?:Source|Sources):\s+(.+)$/i);
  let statement = text;
  if (sourceTail?.[1] && sourceTail.index !== undefined) {
    statement = text.slice(0, sourceTail.index).trim();
    collectCitations(sourceTail[1], citations);
  }
  const urls = statement.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  for (const url of urls) citations.push({ kind: "url", url: url.replace(/[.,]$/, "") });
  return { statement: normalizeSpace(statement), citations: uniqueCitations(citations) };
}

function collectCitations(text: string, into: Citation[]) {
  for (const link of text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
    const note = link[1]?.trim();
    if (note) into.push({ kind: "note", note });
  }
  for (const url of text.match(/https?:\/\/[^\s)\]]+/g) ?? []) {
    into.push({ kind: "url", url: url.replace(/[.,]$/, "") });
  }
}

function uniqueCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const citation of citations) {
    const key = citation.kind === "url" ? `url:${citation.url}` : `note:${citation.note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(citation);
  }
  return out;
}

export function isStructuralLine(text: string): boolean {
  return /^(author|related|part of|see|see also)\b/i.test(text.trim());
}

export function extractStatements(markdown: string): string[] {
  const text = stripObsidianComments(markdown).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let fence = false;
  const flush = () => {
    const joined = normalizeSpace(paragraph.join(" "));
    paragraph = [];
    if (joined && !isStructuralLine(joined)) out.push(joined);
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(">") || trimmed.startsWith("---")) {
      flush();
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      flush();
      const item = trimmed.replace(/^[-*]\s+/, "").trim();
      if (item && !isStructuralLine(item) && !/^\[\[[^\]]+\]\]$/.test(item)) out.push(item);
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return out.filter((block) => {
    const { statement } = stripSourceClause(block);
    return wordCount(statement) >= 6;
  });
}

export function sentencesOf(text: string): string[] {
  const clean = normalizeSpace(text);
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => wordCount(part) >= 6);
}

export function grounded(statement: string, corpus: string): boolean {
  const left = normalizeSpace(statement).toLowerCase();
  const right = normalizeSpace(corpus).toLowerCase();
  if (left.length >= 24 && right.includes(left)) return true;
  const wanted = new Set(contentTokens(statement));
  if (wanted.size === 0) return false;
  const have = new Set(contentTokens(corpus));
  let hits = 0;
  for (const token of wanted) if (have.has(token)) hits += 1;
  return hits >= 3 && hits / wanted.size >= 0.5;
}

export function relativePosix(fromFile: string, toFile: string): string {
  const fromDir = fromFile.split("/").slice(0, -1);
  const toParts = toFile.split("/");
  let index = 0;
  while (index < fromDir.length && index < toParts.length && fromDir[index] === toParts[index]) index += 1;
  const up = fromDir.slice(index).map(() => "..");
  const down = toParts.slice(index);
  const rel = [...up, ...down].join("/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

export function takeTitle(wanted: string, used: Set<string>): string {
  const base = safeTitle(wanted) || "Note";
  let title = base;
  let n = 2;
  while (used.has(title)) {
    title = `${base} ${n}`;
    n += 1;
  }
  used.add(title);
  return title;
}
