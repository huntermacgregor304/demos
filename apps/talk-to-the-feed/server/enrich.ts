import { canonicalUrl, sourceFromUrl } from "../src/lib/citations";
import { enrichmentFromOEmbed, enrichmentFromOpenGraph, type OEmbedBody } from "../src/lib/html-meta";
import type { Enrichment } from "../src/lib/types";

const MAX_URLS = 8;
const MAX_BYTES = 500_000;

export function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host === "metadata.google.internal" || host.endsWith(".internal")) return false;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
  return true;
}

function emptyEnrichment(url: string): Enrichment {
  return {
    url: canonicalUrl(url),
    source: sourceFromUrl(url),
    authorName: "Original post",
    handle: "",
    text: "",
    provider: "none",
    ok: false,
  };
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("Preview response was too large.");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function enrichUrl(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<Enrichment> {
  if (!isPublicHttpUrl(rawUrl)) return emptyEnrichment(rawUrl);
  const source = sourceFromUrl(rawUrl);
  try {
    if (source === "x") {
      const endpoint = new URL("https://publish.twitter.com/oembed");
      endpoint.searchParams.set("omit_script", "true");
      endpoint.searchParams.set("url", rawUrl);
      const response = await fetchImpl(endpoint, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        redirect: "follow",
      });
      if (!response.ok) return emptyEnrichment(rawUrl);
      const body = (await response.json()) as OEmbedBody;
      return enrichmentFromOEmbed(rawUrl, body);
    }
    const response = await fetchImpl(rawUrl, {
      headers: {
        Accept: "text/html",
        "User-Agent": "TalkToTheFeed/1.0",
      },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (!response.ok) return emptyEnrichment(rawUrl);
    const html = await readLimited(response);
    return enrichmentFromOpenGraph(rawUrl, html);
  } catch {
    return emptyEnrichment(rawUrl);
  }
}

export async function handleEnrich(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const payload = await request.json().catch(() => null);
  const urls = payload && typeof payload === "object" && Array.isArray((payload as { urls?: unknown }).urls)
    ? (payload as { urls: unknown[] }).urls.filter((url): url is string => typeof url === "string").slice(0, MAX_URLS)
    : [];
  if (!urls.length) return Response.json({ error: "No urls to enrich." }, { status: 400 });
  const enrichments = await Promise.all(urls.map((url) => enrichUrl(url, fetchImpl)));
  return Response.json({ enrichments });
}
