import { describe, expect, test } from "bun:test";
import { assembleFeed, canonicalUrl, extractCitationUrls, projectCitations, sourceFromUrl, stripMarkers } from "../src/lib/citations";
import { enrichmentFromOEmbed, enrichmentFromOpenGraph } from "../src/lib/html-meta";
import { FACEBOOK_HTML } from "../src/fixtures/facebook-post";
import tweetOembed from "../src/fixtures/tweet-oembed.json";
import { MOCK_COMMENTS, MOCK_ENRICHMENTS, MOCK_FACEBOOK_URL, MOCK_STORY_PAYLOAD, MOCK_X_URL } from "../src/lib/mock-script";
import { parseStoryPayload } from "../src/lib/story";
import type { FeedCard, Story } from "../src/lib/types";

const story = parseStoryPayload(MOCK_STORY_PAYLOAD, () => "2026-10-23T21:41:00.000Z").story!;

describe("citation to card", () => {
  test("classifies hosts and canonicalizes status urls", () => {
    expect(sourceFromUrl("https://twitter.com/mock_orbit_fan/status/1001")).toBe("x");
    expect(sourceFromUrl("https://www.facebook.com/mockorbitrunclub/posts/2002")).toBe("facebook");
    expect(sourceFromUrl("https://youtu.be/mockvideo01")).toBe("youtube");
    expect(sourceFromUrl("https://example.com/post")).toBe("web");
    expect(canonicalUrl("https://twitter.com/mock_orbit_fan/status/1001?s=20")).toBe("https://x.com/mock_orbit_fan/status/1001");
    expect(canonicalUrl(MOCK_FACEBOOK_URL)).toBe("https://facebook.com/mockorbitrunclub/posts/2002");
  });

  test("oEmbed and Open Graph fixtures become card fields, not invented copy", () => {
    const x = enrichmentFromOEmbed(MOCK_X_URL, tweetOembed);
    expect(x.ok).toBe(true);
    expect(x.authorName).toBe("Mina Cole");
    expect(x.handle).toBe("@mock_orbit_fan");
    expect(x.text).toContain("colorway is ridiculous");
    expect(x.text).not.toContain("Mina Cole (@mock_orbit_fan)");
    expect(x.thumbnail).toBe("/mock/colorway.svg");

    const facebook = enrichmentFromOpenGraph(MOCK_FACEBOOK_URL, FACEBOOK_HTML);
    expect(facebook.authorName).toBe("Orbit Run Club");
    expect(facebook.text).toContain("cropped so tight");
    expect(facebook.thumbnail).toBe("/mock/sole.svg");
    expect(facebook.source).toBe("facebook");
  });

  test("joins YouTube comments and enriched posts, ignoring model-written text", () => {
    const cards = assembleFeed(story, MOCK_COMMENTS, Object.fromEntries(MOCK_ENRICHMENTS.map((item) => [item.url, item])));
    const x = cards.find((card) => card.id === "1")!;
    const facebook = cards.find((card) => card.id === "2")!;
    const youtube = cards.find((card) => card.id === "3")!;
    expect(x.text).toContain("Restock Friday");
    expect(x.text).not.toContain("INVENTED");
    expect(x.contentFrom).toBe("oembed");
    expect(facebook.text).toContain("sole");
    expect(facebook.contentFrom).toBe("opengraph");
    expect(youtube.text).toContain("foam recipe went flat");
    expect(youtube.text).not.toContain("INVENTED");
    expect(youtube.likeCount).toBe(842);
    expect(youtube.replyCount).toBe(96);
    expect(youtube.url).toContain("lc=Ucmockcomment1");
    expect(youtube.why).toContain("durability");
    expect(youtube.videoTitle).toContain("first look");
  });

  test("leaves X and Facebook blank when enrichment failed", () => {
    const [x] = assembleFeed(story, [], {});
    expect(x?.text).toBe("");
    expect(x?.contentFrom).toBe("unavailable");
  });

  test("cite markers reveal cards in order and stay out of the visible transcript", () => {
    const cards = assembleFeed(story, MOCK_COMMENTS, Object.fromEntries(MOCK_ENRICHMENTS.map((item) => [item.url, item])));
    const first = projectCitations(cards, "Orbit Sneakers are splitting the room. zxcite1 Mina Cole has the post.", story);
    expect(first.cards.filter((card) => card.cited).map((card) => card.id)).toEqual(["1"]);
    expect(first.activeId).toBe("1");
    const second = projectCitations(cards, "zxcite1 one. zxcite2 two.", story);
    expect(second.cards.filter((card) => card.cited).map((card) => card.id)).toEqual(["1", "2"]);
    expect(second.activeId).toBe("2");
    expect(stripMarkers("zxcite1 Mina Cole has the post.")).toBe("Mina Cole has the post.");
    expect(stripMarkers("See [[cite-3]] next.")).toBe("See next.");
  });

  test("a cue inside the headline does not reveal the card early", () => {
    const early: Story = {
      ...story,
      headline: "Mina Cole leads the chat",
      summary: "A short summary follows here.",
      cards: story.cards.map((card) => (card.id === "1" ? { ...card, cue: "Mina Cole" } : card)),
    };
    const cards = assembleFeed(early, MOCK_COMMENTS, Object.fromEntries(MOCK_ENRICHMENTS.map((item) => [item.url, item])));
    const duringHeadline = projectCitations(cards, "Mina Cole leads the chat", early);
    expect(duringHeadline.cards.find((card) => card.id === "1")?.cited).toBe(false);
    const duringDiscussion = projectCitations(
      cards,
      "Mina Cole leads the chat A short summary follows here. Later Mina Cole says the foam failed.",
      early,
    );
    expect(duringDiscussion.cards.find((card) => card.id === "1")?.cited).toBe(true);
  });

  test("corpus citations stay off the cards, inline annotations reveal a match", () => {
    const corpus = extractCitationUrls({
      type: "response.done",
      response: { citations: [MOCK_X_URL, "https://x.com/i/status/999999"] },
    });
    expect(corpus.every((item) => item.inline === false)).toBe(true);

    const inline = extractCitationUrls({
      type: "response.content_part.done",
      part: {
        transcript: "Mina Cole said it.",
        annotations: [{ type: "url_citation", url: MOCK_X_URL }],
      },
    });
    expect(inline.some((item) => item.inline && item.url === MOCK_X_URL)).toBe(true);

    const cards: FeedCard[] = assembleFeed(story, MOCK_COMMENTS, Object.fromEntries(MOCK_ENRICHMENTS.map((item) => [item.url, item])));
    const revealed = projectCitations(cards, `note ${MOCK_X_URL}`, story);
    expect(revealed.cards.find((card) => card.id === "1")?.cited).toBe(true);
    expect(revealed.cards.find((card) => card.id === "2")?.cited).toBe(false);
  });
});
