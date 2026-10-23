import type { YoutubeComment, YoutubeVideo } from "./types";

export const YOUTUBE_MAX_VIDEOS = 3;
export const YOUTUBE_MAX_COMMENTS = 5;
export const YOUTUBE_CACHE_TTL_MS = 15 * 60 * 1000;

export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function youtubeSearchUrl(query: string, apiKey: string): string {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", String(YOUTUBE_MAX_VIDEOS));
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

export function youtubeCommentsUrl(videoId: string, apiKey: string): string {
  const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("order", "relevance");
  url.searchParams.set("maxResults", String(YOUTUBE_MAX_COMMENTS));
  url.searchParams.set("textFormat", "plainText");
  url.searchParams.set("key", apiKey);
  return url.toString();
}

export function commentPermalink(videoId: string, commentId: string): string {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  url.searchParams.set("lc", commentId);
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function thumbnailUrl(snippet: Record<string, unknown>): string {
  const thumbs = asRecord(snippet.thumbnails);
  if (!thumbs) return "";
  for (const key of ["medium", "high", "default"]) {
    const entry = asRecord(thumbs[key]);
    if (entry && typeof entry.url === "string") return entry.url;
  }
  return "";
}

export function parseSearchList(body: unknown): YoutubeVideo[] {
  const record = asRecord(body);
  if (!record || !Array.isArray(record.items)) return [];
  const videos: YoutubeVideo[] = [];
  for (const item of record.items) {
    const row = asRecord(item);
    const id = asRecord(row?.id);
    const snippet = asRecord(row?.snippet);
    const videoId = typeof id?.videoId === "string" ? id.videoId : "";
    if (!videoId || !snippet) continue;
    videos.push({
      videoId,
      title: typeof snippet.title === "string" ? snippet.title : "Untitled video",
      thumbnail: thumbnailUrl(snippet),
      channelTitle: typeof snippet.channelTitle === "string" ? snippet.channelTitle : "",
      publishedAt: typeof snippet.publishedAt === "string" ? snippet.publishedAt : "",
    });
    if (videos.length >= YOUTUBE_MAX_VIDEOS) break;
  }
  return videos;
}

function decodeLoose(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseCommentThreads(body: unknown, video: YoutubeVideo): YoutubeComment[] {
  const record = asRecord(body);
  if (!record || !Array.isArray(record.items)) return [];
  const comments: YoutubeComment[] = [];
  for (const item of record.items) {
    const thread = asRecord(item);
    const snippet = asRecord(thread?.snippet);
    const top = asRecord(snippet?.topLevelComment);
    const commentSnippet = asRecord(top?.snippet);
    const commentId = typeof top?.id === "string" ? top.id : "";
    if (!commentId || !commentSnippet) continue;
    const rawText =
      typeof commentSnippet.textOriginal === "string"
        ? commentSnippet.textOriginal
        : typeof commentSnippet.textDisplay === "string"
          ? commentSnippet.textDisplay
          : "";
    const text = decodeLoose(rawText);
    if (!text) continue;
    const likeCount = typeof commentSnippet.likeCount === "number" ? commentSnippet.likeCount : 0;
    const replyCount = typeof snippet?.totalReplyCount === "number" ? snippet.totalReplyCount : 0;
    comments.push({
      commentId,
      videoId: video.videoId,
      videoTitle: video.title,
      videoThumbnail: video.thumbnail,
      authorName: typeof commentSnippet.authorDisplayName === "string" ? commentSnippet.authorDisplayName : "Someone",
      text,
      likeCount,
      replyCount,
      publishedAt: typeof commentSnippet.publishedAt === "string" ? commentSnippet.publishedAt : "",
      url: commentPermalink(video.videoId, commentId),
    });
    if (comments.length >= YOUTUBE_MAX_COMMENTS) break;
  }
  return comments;
}

export function toModelComment(comment: YoutubeComment) {
  return {
    comment_id: comment.commentId,
    video_id: comment.videoId,
    video_title: comment.videoTitle,
    author: comment.authorName,
    text: comment.text.slice(0, 400),
    like_count: comment.likeCount,
    reply_count: comment.replyCount,
    url: comment.url,
  };
}
