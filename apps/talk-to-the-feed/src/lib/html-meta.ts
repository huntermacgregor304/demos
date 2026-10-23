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
