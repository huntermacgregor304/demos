import { describe, expect, test } from "bun:test";
import { TtlCache } from "../src/lib/cache";
import {
  normalizeQuery,
  parseCommentThreads,
  parseSearchList,
  youtubeCommentsUrl,
  youtubeSearchUrl,
  YOUTUBE_MAX_COMMENTS,
  YOUTUBE_MAX_VIDEOS,
} from "../src/lib/youtube";
import searchBody from "../src/fixtures/youtube-search.json";
import commentsBody from "../src/fixtures/youtube-comments.json";
import { resetYoutubeCache, searchYoutubeComments } from "../server/youtube";
import { isPublicHttpUrl } from "../server/enrich";

describe("youtube parsing", () => {
  test("keeps three recent videos and skips non-video rows", () => {
    const videos = parseSearchList(searchBody);
    expect(videos).toHaveLength(YOUTUBE_MAX_VIDEOS);
    expect(videos.map((video) => video.videoId)).toEqual(["mockvideo01", "mockvideo02", "mockvideo03"]);
    expect(videos[0]?.title).toContain("first look");
    expect(videos[0]?.thumbnail).toBe("/mock/sneaker.svg");
  });

  test("reads comment text, likes, replies, and the lc permalink", () => {
    const video = parseSearchList(searchBody)[0]!;
    const comments = parseCommentThreads(commentsBody, video);
    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({
      commentId: "Ucmockcomment1",
      authorName: "Devon Park",
      likeCount: 842,
      replyCount: 96,
    });
    expect(comments[0]?.text).toContain("Has anyone put real miles");
    expect(comments[0]?.url).toBe("https://www.youtube.com/watch?v=mockvideo01&lc=Ucmockcomment1");
    expect(comments[1]?.text).toBe("Colorway is & loud <3");
  });

  test("caps comment threads at five", () => {
    const video = parseSearchList(searchBody)[0]!;
    const items = Array.from({ length: 6 }, (_, index) => ({
      snippet: {
        totalReplyCount: index,
        topLevelComment: {
          id: `c${index}`,
          snippet: { authorDisplayName: "A", textOriginal: `Comment ${index}`, likeCount: index },
        },
      },
    }));
    expect(parseCommentThreads({ items }, video)).toHaveLength(YOUTUBE_MAX_COMMENTS);
  });

  test("search.list is ordered by date and commentThreads by relevance", () => {
    const search = new URL(youtubeSearchUrl("Orbit Sneakers", "test-key"));
    expect(search.searchParams.get("order")).toBe("date");
    expect(search.searchParams.get("maxResults")).toBe("3");
    expect(search.searchParams.get("type")).toBe("video");
    expect(search.searchParams.get("part")).toBe("snippet");
    const comments = new URL(youtubeCommentsUrl("mockvideo01", "test-key"));
    expect(comments.searchParams.get("order")).toBe("relevance");
    expect(comments.searchParams.get("maxResults")).toBe("5");
    expect(comments.searchParams.get("textFormat")).toBe("plainText");
    expect(normalizeQuery("  Orbit   Sneakers ")).toBe("orbit sneakers");
  });

  test("caches a query and skips videos whose comments are disabled", async () => {
    resetYoutubeCache();
    let calls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("/search")) {
        return Response.json({
          items: [
            { id: { videoId: "one" }, snippet: { title: "One", thumbnails: { medium: { url: "/a.svg" } } } },
            { id: { videoId: "two" }, snippet: { title: "Two", thumbnails: {} } },
          ],
        });
      }
      if (url.includes("videoId=two")) {
        return Response.json({ error: { message: "commentsDisabled" } }, { status: 403 });
      }
      return Response.json({
        items: [
          {
            snippet: {
              totalReplyCount: 4,
              topLevelComment: {
                id: "c-live",
                snippet: { authorDisplayName: "Ada", textOriginal: "Worth a look", likeCount: 9 },
              },
            },
          },
        ],
      });
    };

    const first = await searchYoutubeComments("Orbit Sneakers", "test-key", fetchImpl, 1_000);
    expect(first.map((comment) => comment.commentId)).toEqual(["c-live"]);
    const afterFirst = calls;
    const second = await searchYoutubeComments("  orbit sneakers ", "test-key", fetchImpl, 1_500);
    expect(second).toEqual(first);
    expect(calls).toBe(afterFirst);
  });

  test("cache expires and evicts the oldest entry", () => {
    const cache = new TtlCache<string>(1000, 2);
    cache.set("a", "1", 0);
    cache.set("b", "2", 0);
    expect(cache.get("a", 500)).toBe("1");
    expect(cache.get("a", 1001)).toBeUndefined();
    cache.set("a", "1", 0);
    cache.set("b", "2", 0);
    cache.set("c", "3", 0);
    expect(cache.get("a", 0)).toBeUndefined();
    expect(cache.get("c", 0)).toBe("3");
  });
});

describe("enrichment guards", () => {
  test("blocks local and link-local targets", () => {
    expect(isPublicHttpUrl("https://x.com/mock_orbit_fan/status/1001")).toBe(true);
    expect(isPublicHttpUrl("http://127.0.0.1/latest")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isPublicHttpUrl("http://10.0.0.5/a")).toBe(false);
    expect(isPublicHttpUrl("http://localhost/a")).toBe(false);
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
  });
});
