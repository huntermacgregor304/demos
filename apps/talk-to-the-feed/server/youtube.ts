import { TtlCache } from "../src/lib/cache";
import type { YoutubeComment } from "../src/lib/types";
import {
  normalizeQuery,
  parseCommentThreads,
  parseSearchList,
  toModelComment,
  YOUTUBE_CACHE_TTL_MS,
  youtubeCommentsUrl,
  youtubeSearchUrl,
} from "../src/lib/youtube";

const cache = new TtlCache<YoutubeComment[]>(YOUTUBE_CACHE_TTL_MS);

export function resetYoutubeCache(): void {
  cache.clear();
}

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function apiMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

export async function searchYoutubeComments(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<YoutubeComment[]> {
  const key = normalizeQuery(query);
  if (!key) return [];
  const cached = cache.get(key, now);
  if (cached) return cached;

  const searchResponse = await fetchImpl(youtubeSearchUrl(key, apiKey));
  const searchBody = await readBody(searchResponse);
  if (!searchResponse.ok) {
    throw new Error(apiMessage(searchBody, `YouTube search failed (${searchResponse.status}).`));
  }
  const videos = parseSearchList(searchBody);
  const comments: YoutubeComment[] = [];
  for (const video of videos) {
    const response = await fetchImpl(youtubeCommentsUrl(video.videoId, apiKey));
    const body = await readBody(response);
    if (!response.ok) {
      const message = apiMessage(body, "");
      if (response.status === 403 || /commentsDisabled|disabled comments/i.test(message)) continue;
      throw new Error(message || `YouTube comments failed (${response.status}).`);
    }
    comments.push(...parseCommentThreads(body, video));
  }
  cache.set(key, comments, now);
  return comments;
}

export async function handleYoutube(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "YOUTUBE_API_KEY is not set on the server." }, { status: 503 });
  }
  const payload = await request.json().catch(() => null);
  const query = payload && typeof payload === "object" && typeof (payload as { query?: unknown }).query === "string"
    ? (payload as { query: string }).query
    : "";
  if (!normalizeQuery(query)) {
    return Response.json({ error: "Missing a topic to search." }, { status: 400 });
  }
  try {
    const comments = await searchYoutubeComments(query, apiKey, fetchImpl);
    return Response.json({
      query: normalizeQuery(query),
      comments,
      for_model: comments.map(toModelComment),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube search failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
