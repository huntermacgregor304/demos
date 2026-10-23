import { enrichmentFromOEmbed, enrichmentFromOpenGraph } from "./html-meta";
import { parseCommentThreads, parseSearchList } from "./youtube";
import { FACEBOOK_HTML } from "../fixtures/facebook-post";
import searchBody from "../fixtures/youtube-search.json";
import commentsBody from "../fixtures/youtube-comments.json";
import tweetOembed from "../fixtures/tweet-oembed.json";
import type { RealtimeEvent, YoutubeComment } from "./types";

export const MOCK_X_URL = "https://x.com/mock_orbit_fan/status/1001";
export const MOCK_FACEBOOK_URL = "https://www.facebook.com/mockorbitrunclub/posts/2002";

const video = parseSearchList(searchBody)[0];

export const MOCK_COMMENTS: YoutubeComment[] = parseCommentThreads(commentsBody, video);

export const MOCK_ENRICHMENTS = [
  enrichmentFromOEmbed(MOCK_X_URL, tweetOembed),
  enrichmentFromOpenGraph(MOCK_FACEBOOK_URL, FACEBOOK_HTML),
];

export const MOCK_STORY_PAYLOAD = {
  headline: "Orbit Sneakers split the room",
  summary:
    "Early reactions to the fictional Orbit drop are warm on X and cooler in YouTube comments. People like the look, and they keep asking whether the foam holds up after a week. Public Facebook pages are mostly arguing about the cropped launch photo.",
  mood: [
    { source: "x", positive: 70, neutral: 20, negative: 10, gist: "X is mostly positive" },
    { source: "facebook", positive: 30, neutral: 50, negative: 20, gist: "Facebook is mixed" },
    { source: "youtube", positive: 20, neutral: 25, negative: 55, gist: "YouTube is skeptical" },
  ],
  questions: [
    { text: "Are they actually restocking Friday at 10?", source: "x", card_id: "1" },
    { text: "Why is the launch photo cropped so tight?", source: "facebook", card_id: "2" },
    { text: "Has anyone put real miles on these yet?", source: "youtube", card_id: "3" },
  ],
  cards: [
    {
      id: "1",
      source: "x",
      url: MOCK_X_URL,
      cue: "Mina Cole",
      why: "The post people are passing around, and it names a restock time.",
      text: "THIS TEXT IS INVENTED AND MUST NOT BE SHOWN",
    },
    {
      id: "2",
      source: "facebook",
      url: MOCK_FACEBOOK_URL,
      cue: "Orbit Run Club",
      why: "A public page thread about the crop hiding the sole.",
    },
    {
      id: "3",
      source: "youtube",
      url: "https://www.youtube.com/watch?v=mockvideo01&lc=Ucmockcomment1",
      comment_id: "Ucmockcomment1",
      cue: "Devon Park",
      why: "High likes and a durability complaint the posts never mention.",
      text: "ALSO INVENTED",
    },
  ],
};

const SPEECH = [
  "Orbit Sneakers are splitting the room. ",
  "Early reactions are warm on X and cooler in the YouTube comments. ",
  "People like the look, and they keep asking whether the foam holds up after a week. ",
  "X is mostly positive, YouTube is skeptical. ",
  "zxcite1 Mina Cole has the post people are sharing, and it names a Friday restock. ",
  "zxcite2 Orbit Run Club is stuck on the cropped launch photo. ",
  "zxcite3 Devon Park's comment is the one worth your time. The foam went flat within a week, and the replies piled on.",
];

export interface TimedEvent {
  at: number;
  event: RealtimeEvent;
}

const BEATS: { event: RealtimeEvent; gap: number }[] = [
  {
    event: {
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "What are people saying about Orbit Sneakers?",
    },
    gap: 500,
  },
  { event: { type: "response.created", response: { id: "resp_tools" } }, gap: 250 },
  { event: { type: "response.output_audio_transcript.delta", delta: "I'm checking the feed." }, gap: 400 },
  {
    event: {
      type: "response.function_call_arguments.done",
      name: "render_story",
      call_id: "call_story",
      arguments: JSON.stringify(MOCK_STORY_PAYLOAD),
    },
    gap: 300,
  },
  { event: { type: "response.done", response: { id: "resp_tools", status: "completed" } }, gap: 350 },
  { event: { type: "response.created", response: { id: "resp_speech" } }, gap: 200 },
  ...SPEECH.map((delta, index) => ({
    event: { type: "response.output_audio_transcript.delta", delta },
    gap: delta.includes("zxcite") ? 1700 : index < 2 ? 900 : 700,
  })),
  { event: { type: "response.output_audio.delta", delta: "AAAA" }, gap: 250 },
  {
    event: {
      type: "response.done",
      response: {
        id: "resp_speech",
        status: "completed",
        citations: ["https://x.com/mock_orbit_fan/status/1001", "https://x.com/i/status/999999"],
      },
    },
    gap: 0,
  },
];

export function buildMockTimeline(): TimedEvent[] {
  const events: TimedEvent[] = [];
  let at = 400;
  for (const beat of BEATS) {
    events.push({ at, event: beat.event });
    at += beat.gap;
  }
  return events;
}

export const MOCK_TIMELINE = buildMockTimeline();
