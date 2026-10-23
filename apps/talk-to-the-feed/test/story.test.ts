import { describe, expect, test } from "bun:test";
import { formatAsOf, normalizeMood, parseStoryPayload } from "../src/lib/story";
import { MOCK_STORY_PAYLOAD } from "../src/lib/mock-script";

describe("story payload", () => {
  test("parses the mock render_story payload and drops invented post text", () => {
    const parsed = parseStoryPayload(JSON.stringify(MOCK_STORY_PAYLOAD), () => "2026-10-23T21:41:00.000Z");
    expect(parsed.ok).toBe(true);
    expect(parsed.story?.headline).toBe("Orbit Sneakers split the room");
    expect(parsed.story?.summary.split(".").filter((part) => part.trim()).length).toBeGreaterThanOrEqual(2);
    expect(parsed.story?.asOf).toBe("2026-10-23T21:41:00.000Z");
    expect(parsed.story?.mood.find((mood) => mood.source === "x")).toMatchObject({ positive: 70, neutral: 20, negative: 10 });
    expect(parsed.story?.questions.map((question) => question.cardId)).toEqual(["1", "2", "3"]);
    expect(parsed.story?.cards[0]).not.toHaveProperty("text");
    expect(JSON.stringify(parsed.story)).not.toContain("INVENTED");
    expect(parsed.story?.cards[2]?.commentId).toBe("Ucmockcomment1");
  });

  test("accepts an object, aliases, and card id prefixes", () => {
    const parsed = parseStoryPayload({
      headline: "One line",
      summary: "Two sentences live here. The second one too.",
      mood: [{ source: "twitter", positive: "70", neutral: "20", negative: "10", gist: "mostly positive" }],
      questions: [{ text: "Is it real?", source: "yt", cardId: "cite-2" }],
      cards: [{ id: "zxcite2", source: "youtube", comment_id: "abc", cue: "Ada", why: "High likes" }],
    });
    expect(parsed.story?.mood[0]?.source).toBe("x");
    expect(parsed.story?.questions[0]?.cardId).toBe("2");
    expect(parsed.story?.cards[0]).toMatchObject({ id: "2", source: "youtube", commentId: "abc" });
  });

  test("rejects invalid JSON and a missing headline", () => {
    expect(parseStoryPayload("{").ok).toBe(false);
    expect(parseStoryPayload({ summary: "No headline" }).story).toBeNull();
  });

  test("normalizes fractions and uneven splits to 100", () => {
    expect(normalizeMood(0.7, 0.2, 0.1)).toEqual([70, 20, 10]);
    expect(normalizeMood(1, 1, 2)).toEqual([25, 25, 50]);
    expect(normalizeMood(70, 20, 10)).toEqual([70, 20, 10]);
    expect(normalizeMood(0, 0, 0)).toEqual([0, 0, 0]);
  });

  test("formats the as-of stamp", () => {
    expect(formatAsOf("not-a-date")).toBe("as of just now");
    expect(formatAsOf("2026-10-23T21:41:00.000Z")).toContain("as of ");
  });
});
