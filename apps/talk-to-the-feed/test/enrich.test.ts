import { describe, expect, test } from "bun:test";
import { statusIdFromUrl } from "../src/lib/citations";
import { mediaFromSyndication } from "../src/lib/html-meta";
import { enrichUrl, readLimited } from "../server/enrich";

function chunkedHtml(html: string, chunkSize = 64_000): Response {
  const bytes = new TextEncoder().encode(html);
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(bytes.length, offset + chunkSize);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/html" } });
}

describe("card enrichment", () => {
  test("an oversized page keeps the head instead of failing the preview", async () => {
    const head =
      '<!doctype html><html><head><meta property="og:description" content="Public Tesla page"><meta property="og:site_name" content="Tesla"></head><body>';
    const html = `${head}${"m".repeat(700_000)}TAIL_MARKER_NOT_IN_HEAD`;
    const limited = await readLimited(chunkedHtml(html));
    expect(limited).toContain("Public Tesla page");
    expect(limited.includes("TAIL_MARKER_NOT_IN_HEAD")).toBe(false);
    expect(limited.length < html.length).toBe(true);

    const facebook = await enrichUrl("https://www.facebook.com/tesla", async () => chunkedHtml(html));
    expect(facebook.ok).toBe(true);
    expect(facebook.text).toBe("Public Tesla page");
    expect(facebook.authorName).toBe("Tesla");
    expect(facebook.provider).toBe("opengraph");
  });

  test("X text stays on oEmbed and the thumbnail comes from syndication", async () => {
    expect(statusIdFromUrl("https://x.com/mock_orbit_fan/status/1001?s=20")).toBe("1001");
    expect(statusIdFromUrl("https://twitter.com/i/status/42")).toBe("42");
    expect(statusIdFromUrl("https://x.com/mock_orbit_fan")).toBeNull();

    const calls: string[] = [];
    const enriched = await enrichUrl("https://x.com/mock_orbit_fan/status/1001", async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      if (url.includes("publish.twitter.com/oembed")) {
        return Response.json({
          author_name: "Mina Cole",
          author_url: "https://x.com/mock_orbit_fan",
          html: "<blockquote><p>Restock Friday at 10.</p></blockquote>",
        });
      }
      if (url.includes("cdn.syndication.twimg.com/tweet-result")) {
        expect(url).toContain("id=1001");
        expect(url).toContain("token=a");
        return Response.json({
          mediaDetails: [{ media_url_https: "https://pbs.twimg.com/media/abc.jpg" }],
          user: { profile_image_url_https: "https://pbs.twimg.com/profile_images/ava.jpg" },
        });
      }
      return new Response("missing", { status: 404 });
    });

    expect(calls.some((url) => url.includes("oembed"))).toBe(true);
    expect(calls.some((url) => url.includes("tweet-result"))).toBe(true);
    expect(enriched.ok).toBe(true);
    expect(enriched.text).toBe("Restock Friday at 10.");
    expect(enriched.thumbnail).toBe("https://pbs.twimg.com/media/abc.jpg");
    expect(enriched.avatar).toBe("https://pbs.twimg.com/profile_images/ava.jpg");
  });

  test("a failed syndication lookup still keeps the oEmbed text", async () => {
    const enriched = await enrichUrl("https://x.com/mock_orbit_fan/status/1001", async (input) => {
      const url = String(input);
      if (url.includes("oembed")) {
        return Response.json({
          author_name: "Mina Cole",
          author_url: "https://x.com/mock_orbit_fan",
          html: "<blockquote><p>Just the words.</p></blockquote>",
        });
      }
      return new Response("nope", { status: 500 });
    });
    expect(enriched.ok).toBe(true);
    expect(enriched.text).toBe("Just the words.");
    expect(enriched.thumbnail).toBeUndefined();
    expect(mediaFromSyndication({ mediaDetails: [{ media_url_https: "javascript:alert(1)" }] }).thumbnail).toBeUndefined();
  });
});
