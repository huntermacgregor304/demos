import { normalizeCardId } from "./story";
import type { Enrichment, FeedCard, SourceId, Story, YoutubeComment } from "./types";

const CITE_MARKER = /(?:\[\[cite-(\d+)\]\]|\bzxcite(\d+)\b)/gi;

export function citeToken(index: number): string {
  return `zxcite${index}`;
}

export function citeReplaceMap(count = 8): Record<string, string> {
  const map: Record<string, string> = {};
  for (let index = 1; index <= count; index += 1) map[citeToken(index)] = " ";
  return map;
}

export function stripMarkers(raw: string): string {
  return raw
    .replace(/\[\[cite-\d+\]\]/gi, " ")
    .replace(/\bzxcite\d+\b/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export function statusIdFromUrl(raw: string): string | null {
  try {
    const parts = new URL(raw).pathname.split("/").filter(Boolean);
    const index = parts.findIndex((part) => part === "status" || part === "statuses");
    const id = index >= 0 ? parts[index + 1] ?? "" : "";
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function sourceFromUrl(raw: string): SourceId | "web" {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      return "x";
    }
    if (host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host === "fb.watch") {
      return "facebook";
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
    return "web";
  } catch {
    return "web";
  }
}

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    let host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "twitter.com" || host.endsWith(".twitter.com")) host = "x.com";
    if (host === "m.facebook.com" || host === "facebook.com" || host.endsWith(".facebook.com")) host = "facebook.com";
    if (host === "youtu.be") host = "youtu.be";
    if (host === "youtube.com" || host.endsWith(".youtube.com")) host = "youtube.com";
    url.protocol = "https:";
    url.hostname = host;
    url.hash = "";
    const keep = new URLSearchParams();
    for (const key of ["v", "lc"]) {
      const value = url.searchParams.get(key);
      if (value) keep.set(key, value);
    }
    url.search = keep.toString() ? `?${keep.toString()}` : "";
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return raw.trim();
  }
}

export function commentIdFromUrl(raw: string): string | null {
  try {
    return new URL(raw).searchParams.get("lc");
  } catch {
    return null;
  }
}

export function findComment(
  comments: YoutubeComment[],
  ref: { commentId?: string; url: string },
): YoutubeComment | undefined {
  if (ref.commentId) {
    const byId = comments.find((comment) => comment.commentId === ref.commentId);
    if (byId) return byId;
  }
  const fromUrl = commentIdFromUrl(ref.url);
  if (!fromUrl) return undefined;
  return comments.find((comment) => comment.commentId === fromUrl);
}

export interface FoundUrl {
  url: string;
  inline: boolean;
}

const INLINE_KEYS = new Set(["annotation", "annotations", "inline_citation", "inline_citations", "transcript", "delta", "text"]);

function isHttp(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function markdownUrls(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s)>\]]+/gi)) {
    found.push(match[0].replace(/[.,;:!?]+$/, ""));
  }
  return found;
}

export function extractCitationUrls(event: unknown): FoundUrl[] {
  const found: FoundUrl[] = [];
  const seen = new Set<string>();
  const add = (url: string, inline: boolean) => {
    if (!isHttp(url)) return;
    const key = `${inline ? "i" : "c"}:${canonicalUrl(url)}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ url, inline });
  };
  const walk = (node: unknown, key: string, inline: boolean, depth: number) => {
    if (depth > 8 || node == null) return;
    const nextInline = inline || INLINE_KEYS.has(key);
    if (typeof node === "string") {
      if ((key === "url" || key === "uri") && nextInline) add(node, true);
      if ((key === "transcript" || key === "delta" || key === "text") && nextInline) {
        for (const url of markdownUrls(node)) add(url, true);
      }
      if (key === "citations" && inline) add(node, true);
      return;
    }
    if (Array.isArray(node)) {
      if (key === "citations" && !inline) {
        for (const item of node) {
          if (typeof item === "string") add(item, false);
          else walk(item, "citations", false, depth + 1);
        }
        return;
      }
      for (const item of node) walk(item, key, nextInline, depth + 1);
      return;
    }
    if (typeof node === "object") {
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        walk(child, childKey, nextInline || INLINE_KEYS.has(childKey), depth + 1);
      }
    }
  };
  walk(event, "", false, 0);
  return found;
}

function lookupEnrichment(enrichments: Record<string, Enrichment>, url: string): Enrichment | undefined {
  return enrichments[canonicalUrl(url)] ?? enrichments[url];
}

export function assembleFeed(
  story: Story,
  comments: YoutubeComment[],
  enrichments: Record<string, Enrichment>,
): FeedCard[] {
  return story.cards.map((ref) => {
    const base = {
      id: ref.id,
      source: ref.source,
      url: ref.url,
      cue: ref.cue,
      why: ref.why,
      cited: false,
    };
    if (ref.source === "youtube") {
      const comment = findComment(comments, ref);
      if (!comment) {
        return {
          ...base,
          authorName: "YouTube comment",
          handle: "",
          text: "",
          contentFrom: "unavailable" as const,
        };
      }
      return {
        ...base,
        url: comment.url,
        authorName: comment.authorName || "YouTube comment",
        handle: "",
        text: comment.text,
        thumbnail: comment.videoThumbnail || undefined,
        videoTitle: comment.videoTitle,
        likeCount: comment.likeCount,
        replyCount: comment.replyCount,
        contentFrom: "youtube" as const,
      };
    }
    const enrichment = lookupEnrichment(enrichments, ref.url);
    if (!enrichment?.ok || !enrichment.text) {
      return {
        ...base,
        authorName: enrichment?.authorName || "Original post",
        handle: enrichment?.handle || "",
        text: "",
        thumbnail: enrichment?.thumbnail,
        avatar: enrichment?.avatar,
        contentFrom: "unavailable" as const,
      };
    }
    return {
      ...base,
      authorName: enrichment.authorName || "Original post",
      handle: enrichment.handle,
      text: enrichment.text,
      thumbnail: enrichment.thumbnail,
      avatar: enrichment.avatar,
      contentFrom: enrichment.provider === "opengraph" ? "opengraph" : "oembed",
    };
  });
}

function markerPositions(raw: string): { id: string; index: number }[] {
  const positions: { id: string; index: number }[] = [];
  for (const match of raw.matchAll(CITE_MARKER)) {
    const id = String(Number(match[1] || match[2]));
    positions.push({ id, index: match.index ?? 0 });
  }
  return positions;
}

export function projectCitations(
  cards: FeedCard[],
  citationRaw: string,
  story: Story | null,
): { cards: FeedCard[]; activeId: string | null } {
  const markers = markerPositions(citationRaw);
  const visible = stripMarkers(citationRaw);
  const intro = story ? story.headline.length + 1 + story.summary.length : Number.POSITIVE_INFINITY;
  const cueZone = visible.length > intro ? visible.slice(intro) : "";
  const cueZoneLower = cueZone.toLowerCase();

  const projected = cards.map((card) => {
    const id = normalizeCardId(card.id);
    const marked = markers.some((marker) => marker.id === id);
    const urlHit = Boolean(card.url) && visible.includes(card.url);
    const canonicalHit = Boolean(card.url) && visible.includes(canonicalUrl(card.url));
    const cue = card.cue.trim();
    const cueHit = cue.length >= 3 && cueZoneLower.includes(cue.toLowerCase());
    return { ...card, cited: marked || urlHit || canonicalHit || cueHit };
  });

  let activeId: string | null = null;
  let activeAt = -1;
  for (const card of projected) {
    if (!card.cited) continue;
    const id = normalizeCardId(card.id);
    const markerAt = markers.filter((marker) => marker.id === id).at(-1)?.index ?? -1;
    const urlAt = card.url ? visible.indexOf(card.url) : -1;
    const cueAt = card.cue ? cueZoneLower.indexOf(card.cue.toLowerCase()) : -1;
    const at = Math.max(markerAt, urlAt, cueAt >= 0 ? intro + cueAt : -1);
    if (at > activeAt) {
      activeAt = at;
      activeId = card.id;
    }
  }
  return { cards: projected, activeId };
}

export function urlsNeedingEnrichment(cards: FeedCard[], enrichments: Record<string, Enrichment>): string[] {
  const urls: string[] = [];
  for (const card of cards) {
    if (card.source === "youtube" || card.contentFrom === "youtube") continue;
    if (!card.url) continue;
    const existing = lookupEnrichment(enrichments, card.url);
    if (existing?.ok && existing.text) continue;
    urls.push(card.url);
  }
  return [...new Set(urls)];
}
