import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classifyStatement } from "@/claims/classify";
import { runEvidenceCheck, type EvidenceReport } from "@/claims/evidence";
import { parseBookmarks, type Bookmark } from "@/ingest/bookmarks";
import {
  extractStatements,
  relativePosix,
  sentencesOf,
  takeTitle,
  wikilinks,
  type Citation,
} from "@/lib/text";
import type { Claim, ClaimStatus, GraphData, GraphEdge, GraphNode } from "@/types";

export type BuildInput = {
  bookmarksPath: string;
  knowledgePath: string;
  decisionsPath: string;
  vaultDir: string;
  origins: { bookmarks: "file" | "fixture"; knowledge: "file" | "fixture"; decisions: "file" | "fixture" };
  llmNote?: string | null;
};

export type BuildResult = {
  graph: GraphData;
  claims: Claim[];
  evidence: EvidenceReport;
  brokenLinks: string[];
};

type NoteKind = "content" | "meta";

type Note = {
  id: string;
  title: string;
  group: string;
  type: string;
  tags: string[];
  wikiRelative: string;
  rawRelative: string | null;
  body: string;
  grounding: string;
  claims: Claim[];
  claimStatus: ClaimStatus;
  kind: NoteKind;
  evidence: boolean;
  extraCitations: Citation[];
  claimBlocks: string[];
};

const TOPICS: { title: string; pattern: RegExp }[] = [
  { title: "Second Brain", pattern: /second brain/i },
  { title: "Local Vault", pattern: /local vault|wikilinks/i },
  { title: "Claim Check", pattern: /claim check|every claim/i },
];

export function buildVault(input: BuildInput): BuildResult {
  assertSafeVault(input.vaultDir);
  rmSync(input.vaultDir, { recursive: true, force: true });
  mkdirSync(input.vaultDir, { recursive: true });

  const bookmarks = parseBookmarks(readFileSync(input.bookmarksPath, "utf8"));
  const knowledgeRaw = readFileSync(input.knowledgePath, "utf8");
  const decisionsRaw = readFileSync(input.decisionsPath, "utf8");
  const used = new Set<string>();
  const notes: Note[] = [];

  const bookmarkNotes = bookmarks.map((bookmark) => makeBookmark(bookmark, used));
  const topics = TOPICS.filter((topic) => bookmarks.some((bookmark) => topic.pattern.test(bookmark.text))).map((topic) =>
    takeTitle(topic.title, used),
  );
  for (const note of bookmarkNotes) {
    const related = topics.filter((topic) => {
      const spec = TOPICS.find((item) => topic === item.title || topic.startsWith(`${item.title} `));
      return spec ? spec.pattern.test(note.grounding) : false;
    });
    if (related.length) note.body += `\n\nRelated: ${related.map((topic) => `[[${topic}]]`).join(" ")}`;
    note.claimBlocks = sentencesOf(note.grounding);
    note.extraCitations = note.grounding.includes("http") ? urlCitations(note.grounding) : [];
  }
  notes.push(...bookmarkNotes);

  const authors = new Map<string, { title: string; posts: string[]; raw: string | null; handle: string; name: string }>();
  for (const bookmark of bookmarks) {
    const key = (bookmark.authorName || bookmark.author || "Unknown").toLowerCase();
    const post = bookmarkNotes.find((note) => bookmark.url && note.grounding.includes(bookmark.url)) ?? bookmarkNotes[0];
    if (!post) continue;
    const existing = authors.get(key);
    if (existing) {
      existing.posts.push(post.id);
      continue;
    }
    authors.set(key, {
      title: "",
      posts: [post.id],
      raw: post.rawRelative,
      handle: bookmark.author,
      name: bookmark.authorName || bookmark.author || "Unknown",
    });
  }
  for (const author of authors.values()) {
    author.title = takeTitle(author.name, used);
    const body = author.posts.map((post) => `- [[${post}]]`).join("\n");
    notes.push(
      baseNote({
        id: author.title,
        group: "entity",
        type: "entity",
        folder: "entities",
        body,
        grounding: body,
        rawRelative: author.raw,
        evidence: true,
        claimBlocks: [],
      }),
    );
    for (const postId of author.posts) {
      const post = notes.find((note) => note.id === postId);
      if (post) post.body = `Author: [[${author.title}]]\n\n${post.body}`;
    }
  }

  const knowledge = ingestDocument({
    markdown: knowledgeRaw,
    fallbackTitle: "Bot Council Knowledge",
    group: "knowledge",
    folder: "concepts",
    rawRelative: "raw/knowledge/bot-council-knowledge.md",
    sourceLabel: input.origins.knowledge === "fixture" ? "fixture:KNOWLEDGE.md" : path.basename(input.knowledgePath),
    used,
  });
  const decisions = ingestDocument({
    markdown: decisionsRaw,
    fallbackTitle: "Decisions Log",
    group: "decision",
    folder: "decisions",
    rawRelative: "raw/decisions/decisions-log.md",
    sourceLabel: input.origins.decisions === "fixture" ? "fixture:DECISIONS.md" : path.basename(input.decisionsPath),
    used,
  });
  notes.push(...knowledge, ...decisions);

  for (const topic of topics) {
    const posts = bookmarkNotes.filter((note) => {
      const spec = TOPICS.find((item) => topic === item.title || topic.startsWith(`${item.title} `));
      return spec ? spec.pattern.test(note.grounding) : false;
    });
    notes.push(
      baseNote({
        id: topic,
        group: "concept",
        type: "concept",
        folder: "concepts",
        body: posts.map((post) => `- [[${post.id}]]`).join("\n"),
        grounding: posts.map((post) => post.grounding).join("\n"),
        rawRelative: null,
        evidence: false,
        claimBlocks: [],
      }),
    );
  }

  if (topics.includes("Second Brain") && knowledge[0]) {
    knowledge[0].body = `See [[Second Brain]].\n\n${knowledge[0].body}`;
  }
  if (knowledge[0] && decisions[0]) {
    decisions[0].body = `See [[${knowledge[0].id}]].\n\n${decisions[0].body}`;
  }

  writeRawMirrors(input, bookmarks, knowledgeRaw, decisionsRaw);
  classifyNotes(notes);
  writeNotes(input.vaultDir, notes);

  const evidenceArticles = notes.filter((note) => note.evidence && note.rawRelative).map((note) => note.wikiRelative);
  const evidence = runEvidenceCheck(input.vaultDir, evidenceArticles);
  applyEvidence(notes, evidence);
  rollupParents(notes);

  const claims = notes.flatMap((note) => note.claims);
  const sourced = claims.filter((claim) => claim.status === "sourced").length;
  const unverified = claims.filter((claim) => claim.status === "unverified").length;
  const reportStatus: ClaimStatus = sourced && unverified ? "mixed" : unverified ? "unverified" : sourced ? "sourced" : "none";
  const report = metaNote("Claims Report", "report", reportStatus, renderClaimsReport(claims, evidence, input.llmNote));
  const log = metaNote("Log", "log", "none", renderLog(input, notes, claims, evidence));
  notes.push(report, log);
  const edges = contentEdges(notes);
  const backlinks = metaNote("Backlinks", "index", "none", renderBacklinks(notes, edges));
  notes.push(backlinks);
  const index = metaNote("Index", "index", "none", renderIndex(notes));
  notes.push(index);
  writeNotes(input.vaultDir, notes);

  const brokenLinks = findBroken(input.vaultDir, new Set(notes.map((note) => note.id)));
  const graph = graphData(input.vaultDir, notes, edges, input.origins, claims);
  writeFileSync(path.join(input.vaultDir, "graph.json"), JSON.stringify(graph, null, 2));
  return { graph, claims, evidence, brokenLinks };
}

function makeBookmark(bookmark: Bookmark, used: Set<string>): Note {
  const title = takeTitle(bookmark.title || bookmark.text.split(/\s+/).slice(0, 6).join(" ") || bookmark.id, used);
  const idSlug = bookmark.id.replace(/[^A-Za-z0-9._-]+/g, "-");
  const rawRelative = `raw/bookmarks/${idSlug}.md`;
  const urls = bookmark.url ? [{ kind: "url" as const, url: bookmark.url }] : [];
  return baseNote({
    id: title,
    group: "bookmark",
    type: "source",
    folder: "sources",
    body: bookmark.text.trim(),
    grounding: `${bookmark.text}\n${bookmark.url}\n${bookmark.authorName} ${bookmark.author}`,
    rawRelative,
    evidence: true,
    claimBlocks: [],
    extraCitations: urls,
  });
}

function urlCitations(text: string): Citation[] {
  const match = text.match(/https?:\/\/[^\s)]+/);
  return match ? [{ kind: "url", url: match[0] }] : [];
}

function ingestDocument(options: {
  markdown: string;
  fallbackTitle: string;
  group: string;
  folder: string;
  rawRelative: string;
  sourceLabel: string;
  used: Set<string>;
}): Note[] {
  const split = splitSections(options.markdown);
  const parentTitle = takeTitle(split.h1 || options.fallbackTitle, options.used);
  const sectionNotes = split.sections.map((section) => {
    const title = takeTitle(section.title, options.used);
    const body = `${section.body.trim()}\n\nPart of [[${parentTitle}]].`;
    return baseNote({
      id: title,
      group: options.group === "decision" ? "decision" : "concept",
      type: options.group === "decision" ? "decision" : "concept",
      folder: options.folder,
      body,
      grounding: section.body,
      rawRelative: options.rawRelative,
      evidence: true,
      claimBlocks: extractStatements(section.body),
    });
  });
  const links = sectionNotes.map((note) => `- [[${note.id}]]`).join("\n");
  const parentBody = [links, split.intro.trim(), split.rest.trim()].filter(Boolean).join("\n\n");
  const parent = baseNote({
    id: parentTitle,
    group: options.group,
    type: "source",
    folder: "sources",
    body: parentBody,
    grounding: options.markdown,
    rawRelative: options.rawRelative,
    evidence: true,
    claimBlocks: sectionNotes.length ? extractStatements(split.intro) : extractStatements(options.markdown),
  });
  parent.tags.push(options.sourceLabel.startsWith("fixture:") ? "fixture" : "local");
  return [parent, ...sectionNotes];
}

function splitSections(markdown: string): { h1: string; intro: string; rest: string; sections: { title: string; body: string }[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let h1 = "";
  const intro: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      h1 = line.slice(2).trim();
      continue;
    }
    const heading = line.match(/^##\s+(.+)$/);
    if (heading?.[1]) {
      current = { title: heading[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else intro.push(line);
  }
  const rest = sections.map((section) => [`## ${section.title}`, ...section.lines].join("\n")).join("\n\n");
  return {
    h1,
    intro: intro.join("\n").trim(),
    rest,
    sections: sections.map((section) => ({ title: section.title, body: section.lines.join("\n").trim() })),
  };
}

function baseNote(options: {
  id: string;
  group: string;
  type: string;
  folder: string;
  body: string;
  grounding: string;
  rawRelative: string | null;
  evidence: boolean;
  claimBlocks: string[];
  extraCitations?: Citation[];
}): Note {
  return {
    id: options.id,
    title: options.id,
    group: options.group,
    type: options.type,
    tags: [options.group],
    wikiRelative: `wiki/${options.folder}/${options.id}.md`,
    rawRelative: options.rawRelative,
    body: options.body.trim(),
    grounding: options.grounding,
    claims: [],
    claimStatus: "none",
    kind: "content",
    evidence: options.evidence,
    extraCitations: options.extraCitations ?? [],
    claimBlocks: options.claimBlocks,
  };
}

function metaNote(id: string, group: string, status: ClaimStatus, body: string): Note {
  return {
    id,
    title: id,
    group,
    type: group,
    tags: [group],
    wikiRelative: `wiki/${id}.md`,
    rawRelative: null,
    body,
    grounding: body,
    claims: [],
    claimStatus: status,
    kind: "meta",
    evidence: false,
    extraCitations: [],
    claimBlocks: [],
  };
}

function classifyNotes(notes: Note[]) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const urlCorpus = new Map<string, string>();
  for (const note of notes) {
    for (const citation of note.extraCitations) {
      if (citation.kind === "url") urlCorpus.set(citation.url, `${note.grounding}\n${note.body}`);
    }
  }
  for (const note of notes) {
    note.claims = note.claimBlocks.map((block) =>
      classifyStatement(note.id, block, note.extraCitations, {
        note: (title) => {
          const target = byId.get(title);
          if (!target) return null;
          return `${target.grounding}\n${target.body}`;
        },
        url: (url) => urlCorpus.get(url) ?? null,
      }),
    );
    note.claimStatus = rollup(note.claims);
  }
}

function applyEvidence(notes: Note[], evidence: EvidenceReport) {
  const suspects = new Map<string, string[]>();
  for (const hit of evidence.suspects) {
    const base = path.posix.basename(hit.article, ".md");
    suspects.set(base, hit.values);
  }
  for (const note of notes) {
    const values = suspects.get(note.id) ?? [];
    for (const claim of note.claims) {
      const hit = values.find((value) => claim.text.includes(value));
      if (hit && claim.status === "sourced") {
        claim.status = "unverified";
        claim.reason = `evidence check: ${hit} is not in the raw source`;
      }
    }
    if (note.kind === "content") note.claimStatus = rollup(note.claims);
  }
}

function rollup(claims: Claim[]): ClaimStatus {
  if (claims.length === 0) return "none";
  const sourced = claims.some((claim) => claim.status === "sourced");
  const unverified = claims.some((claim) => claim.status === "unverified");
  if (sourced && unverified) return "mixed";
  return sourced ? "sourced" : "unverified";
}

function rollupParents(notes: Note[]) {
  for (const note of notes) {
    if (note.claimBlocks.length > 0) continue;
    const children = notes.filter((other) => other.kind === "content" && other.body.includes(`Part of [[${note.id}]].`));
    if (children.length === 0) continue;
    const claims = children.flatMap((child) => child.claims);
    note.claimStatus = rollup(claims);
  }
}

function writeRawMirrors(input: BuildInput, bookmarks: Bookmark[], knowledge: string, decisions: string) {
  for (const bookmark of bookmarks) {
    const idSlug = bookmark.id.replace(/[^A-Za-z0-9._-]+/g, "-");
    const published = bookmark.createdAt ? bookmark.createdAt.slice(0, 10) : "Unknown";
    writeVault(
      input.vaultDir,
      `raw/bookmarks/${idSlug}.md`,
      rawDoc(
        bookmark.title || bookmark.id,
        bookmark.url || "bookmark",
        published,
        `Author: ${bookmark.authorName} (@${bookmark.author})\n\n${bookmark.url}\n\n${bookmark.text.trim()}`,
      ),
    );
  }
  writeVault(
    input.vaultDir,
    "raw/knowledge/bot-council-knowledge.md",
    rawDoc("Bot Council Knowledge", input.origins.knowledge === "fixture" ? "fixture:KNOWLEDGE.md" : "local-file", "Unknown", knowledge.trim()),
  );
  writeVault(
    input.vaultDir,
    "raw/decisions/decisions-log.md",
    rawDoc("Decisions Log", input.origins.decisions === "fixture" ? "fixture:DECISIONS.md" : "local-file", "Unknown", decisions.trim()),
  );
}

function rawDoc(title: string, source: string, published: string, body: string): string {
  return `# ${title}\n\n> Source: ${source}\n> Collected: 2026-10-31\n> Published: ${published}\n\n${body.trim()}\n`;
}

function writeNotes(vaultDir: string, notes: Note[]) {
  const inbound = inboundMap(notes);
  for (const note of notes) {
    const backlinks =
      note.kind === "content"
        ? (inbound.get(note.id) ?? []).filter((id) => id !== "Index" && id !== "Backlinks" && id !== "Log" && id !== "Claims Report")
        : [];
    writeVault(vaultDir, note.wikiRelative, renderNote(note, backlinks));
  }
}

function renderNote(note: Note, backlinks: string[]): string {
  const sources = [...new Set([...wikilinks(note.body), ...note.claims.map((claim) => claim.sourceLabel)].filter((item) => item.startsWith("[[")))];
  const rawLine = note.rawRelative
    ? `> Raw: [${path.posix.basename(note.rawRelative, ".md")}](${relativePosix(note.wikiRelative, note.rawRelative)})\n`
    : "";
  const claimSection =
    note.claims.length === 0
      ? ""
      : `\n## Claim check\n\n${note.claims
          .map((claim) => `- **${claim.status}** — ${claim.sourceLabel || "no source"} — ${claim.text}`)
          .join("\n")}\n`;
  const backlinkSection =
    backlinks.length === 0 ? "" : `\n## Backlinks\n\n${backlinks.map((id) => `- [[${id}]]`).join("\n")}\n`;
  return `---
title: ${yaml(note.title)}
type: ${note.type}
created: sample-run
tags:
${note.tags.map((tag) => `  - ${yaml(tag)}`).join("\n")}
sources:
${(sources.length ? sources : ["none"]).map((item) => `  - ${yaml(item)}`).join("\n")}
claim_status: ${note.claimStatus}
---

# ${note.title}

> Sources: ${sources.join(", ") || "none"}
${rawLine}> Collected: 2026-10-31

${note.body.trim()}
${claimSection}${backlinkSection}`;
}

function yaml(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderClaimsReport(claims: Claim[], evidence: EvidenceReport, llmNote?: string | null): string {
  const lines = claims.map(
    (claim) => `- **${claim.status}** — [[${claim.noteId}]] — ${claim.sourceLabel || "no source"} — ${claim.text} _(${claim.reason})_`,
  );
  const fidelity =
    evidence.suspects.length === 0
      ? "(none)"
      : evidence.suspects.map((hit) => `- ${hit.article}: ${hit.values.join(", ")}`).join("\n");
  return `Local claim check. A claim is sourced when its citation points at a note or URL that contains the claim. The fidelity sweep is the vendored karpathy-llm-wiki checker.

Engine: \`${evidence.engine}\`

## Fidelity

${fidelity}

${evidence.summary}

## Claims

${lines.join("\n")}
${llmNote ? `\n## LLM\n\n${llmNote}\n` : ""}`;
}

function renderIndex(notes: Note[]): string {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const list = groups.get(note.group) ?? [];
    list.push(note);
    groups.set(note.group, list);
  }
  return [...groups.entries()]
  .map(([group, list]) => `## ${group}\n\n${list.map((note) => `- [[${note.id}]] — ${note.claimStatus}`).join("\n")}`)
    .join("\n\n");
}

function renderLog(input: BuildInput, notes: Note[], claims: Claim[], evidence: EvidenceReport): string {
  const sourced = claims.filter((claim) => claim.status === "sourced").length;
  const unverified = claims.filter((claim) => claim.status === "unverified").length;
  return `## [2026-10-31] ingest

- Bookmarks: ${input.origins.bookmarks}
- Knowledge: ${input.origins.knowledge}
- Decisions: ${input.origins.decisions}
- Notes: ${notes.length}
- Claims: ${sourced} sourced, ${unverified} unverified
- Evidence: ${evidence.summary || "no summary"} (${evidence.engine})
`;
}

function renderBacklinks(notes: Note[], edges: GraphEdge[]): string {
  const inbound = new Map<string, string[]>();
  for (const edge of edges) {
    const list = inbound.get(edge.target) ?? [];
    list.push(edge.source);
    inbound.set(edge.target, list);
  }
  const lines = notes
    .filter((note) => note.kind === "content")
    .map((note) => {
      const from = inbound.get(note.id) ?? [];
      if (from.length === 0) return `- [[${note.id}]] — no inbound content links`;
      return `- [[${note.id}]] — ${from.map((id) => `[[${id}]]`).join(", ")}`;
    });
  return `Inbound content links. Obsidian also derives these from wikilinks.

${lines.join("\n")}
`;
}

function contentEdges(notes: Note[]): GraphEdge[] {
  const ids = new Set(notes.filter((note) => note.kind === "content").map((note) => note.id));
  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (source: string, target: string) => {
    if (!ids.has(source) && source !== "Claims Report") return;
    if (!ids.has(target) && target !== "Claims Report") return;
    if (source === target) return;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target });
  };
  for (const note of notes) {
    if (note.kind !== "content") continue;
    const text = `${note.body}\n${note.claims.map((claim) => `${claim.sourceLabel} ${claim.text}`).join("\n")}`;
    for (const target of wikilinks(text)) add(note.id, target);
  }
  for (const note of notes) {
    if (note.claimStatus === "unverified" || note.claimStatus === "mixed") add("Claims Report", note.id);
  }
  return edges;
}

function inboundMap(notes: Note[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const note of notes) {
    for (const target of wikilinks(`${note.body}\n${note.claims.map((claim) => claim.sourceLabel).join("\n")}`)) {
      const list = map.get(target) ?? [];
      if (!list.includes(note.id)) list.push(note.id);
      map.set(target, list);
    }
  }
  return map;
}

function graphData(
  vaultDir: string,
  notes: Note[],
  edges: GraphEdge[],
  origins: BuildInput["origins"],
  claims: Claim[],
): GraphData {
  const nodes: GraphNode[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    group: note.group,
    claimStatus: note.claimStatus,
    path: note.wikiRelative,
  }));
  return {
    generatedAt: "2026-10-31",
    summary: {
      notes: notes.length,
      sourced: claims.filter((claim) => claim.status === "sourced").length,
      unverified: claims.filter((claim) => claim.status === "unverified").length,
      links: edges.length,
      fixtures: origins.bookmarks === "fixture" && origins.knowledge === "fixture" && origins.decisions === "fixture",
    },
    nodes,
    edges,
    notes: Object.fromEntries(notes.map((note) => [note.id, readFileSync(path.join(vaultDir, note.wikiRelative), "utf8")])),
  };
}

function writeVault(vaultDir: string, relative: string, contents: string) {
  const file = path.join(vaultDir, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents.endsWith("\n") ? contents : `${contents}\n`);
}

function findBroken(vaultDir: string, ids: Set<string>): string[] {
  const broken: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) {
        const text = readFileSync(full, "utf8");
        for (const link of wikilinks(text)) {
          if (!ids.has(link)) broken.push(`${path.relative(vaultDir, full)} -> [[${link}]]`);
        }
      }
    }
  };
  walk(path.join(vaultDir, "wiki"));
  return broken;
}

function assertSafeVault(dir: string) {
  const resolved = path.resolve(dir);
  if (path.basename(resolved) !== "vault") {
    throw new Error(`Refusing to replace ${resolved}. The vault directory must be named "vault".`);
  }
}
