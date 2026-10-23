import { canonicalUrl, sourceFromUrl } from "./citations";
import type { Enrichment } from "./types";

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function textFromOEmbedHtml(html: string): string {
  const paragraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const inner = paragraph ? paragraph[1] : html;
  const stripped = inner
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export function imageFromHtml(html: string): string | undefined {
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1];
}

export function handleFromAuthorUrl(authorUrl: string): string {
  try {
    const parts = new URL(authorUrl).pathname.split("/").filter(Boolean);
    if (!parts[0] || parts[0] === "i" || parts[0] === "intent") return "";
    return `@${parts[0]}`;
  } catch {
    return "";
  }
}

export interface OEmbedBody {
  author_name?: string;
  author_url?: string;
  html?: string;
  url?: string;
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function mediaFromSyndication(body: unknown): { thumbnail?: string; avatar?: string } {
  if (!body || typeof body !== "object") return {};
  const record = body as { mediaDetails?: unknown; user?: unknown };
  const details = Array.isArray(record.mediaDetails) ? record.mediaDetails : [];
  const first = details.find((item) => item && typeof item === "object");
  const thumbnail = first ? httpsUrl((first as { media_url_https?: unknown }).media_url_https) : undefined;
  const user = record.user && typeof record.user === "object" ? record.user : null;
  const avatar = user ? httpsUrl((user as { profile_image_url_https?: unknown }).profile_image_url_https) : undefined;
  return { thumbnail, avatar };
}

export function enrichmentFromOEmbed(pageUrl: string, body: OEmbedBody): Enrichment {
  const text = textFromOEmbedHtml(body.html ?? "");
  const thumbnail = body.html ? imageFromHtml(body.html) : undefined;
  return {
    url: canonicalUrl(pageUrl),
    source: sourceFromUrl(pageUrl),
    authorName: (body.author_name ?? "").trim() || "X post",
    handle: handleFromAuthorUrl(body.author_url ?? ""),
    text,
    thumbnail,
    provider: text ? "oembed" : "none",
    ok: Boolean(text),
  };
}

function metaContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*\\b(?:property|name)=["']${escaped}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\b(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return "";
}

export interface OpenGraph {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export function parseOpenGraph(html: string): OpenGraph {
  return {
    title: metaContent(html, "og:title"),
    description: metaContent(html, "og:description") || metaContent(html, "description"),
    image: metaContent(html, "og:image"),
    siteName: metaContent(html, "og:site_name"),
  };
}

export function enrichmentFromOpenGraph(pageUrl: string, html: string): Enrichment {
  const graph = parseOpenGraph(html);
  const text = graph.description;
  const authorName = graph.siteName || graph.title || "Facebook post";
  return {
    url: canonicalUrl(pageUrl),
    source: sourceFromUrl(pageUrl),
    authorName,
    handle: "",
    text,
    thumbnail: graph.image || undefined,
    provider: text ? "opengraph" : "none",
    ok: Boolean(text),
  };
}
