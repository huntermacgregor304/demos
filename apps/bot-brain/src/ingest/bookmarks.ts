export type Bookmark = {
  id: string;
  url: string;
  text: string;
  author: string;
  authorName: string;
  createdAt: string;
  title: string;
};

export function parseBookmarks(raw: string): Bookmark[] {
  let body = raw.trim();
  if (body.startsWith("window.")) {
    const eq = body.indexOf("=");
    body = body.slice(eq + 1).trim().replace(/;\s*$/, "");
  }
  const json = JSON.parse(body) as unknown;
  const users = new Map<string, { name: string; username: string }>();
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const includes = (json as { includes?: { users?: unknown[] } }).includes;
    for (const user of includes?.users ?? []) {
      if (!user || typeof user !== "object") continue;
      const record = user as Record<string, unknown>;
      const id = stringOf(record.id);
      if (!id) continue;
      users.set(id, {
        name: stringOf(record.name),
        username: stringOf(record.username) || stringOf(record.screen_name),
      });
    }
  }
  return extractRecords(json).map((record, index) => normalize(record, index, users));
}

function extractRecords(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["bookmarks", "data", "items"]) {
      if (Array.isArray(obj[key])) return obj[key];
    }
  }
  throw new Error("Bookmarks file must be a JSON array or an object with a bookmarks array.");
}

function normalize(
  value: unknown,
  index: number,
  users: Map<string, { name: string; username: string }>,
): Bookmark {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const nested = record.bookmark && typeof record.bookmark === "object" ? (record.bookmark as Record<string, unknown>) : null;
  const tweet = record.tweet && typeof record.tweet === "object" ? (record.tweet as Record<string, unknown>) : null;
  const source = { ...record, ...(tweet ?? {}), ...(nested ?? {}) };
  const authorRecord = source.author && typeof source.author === "object" ? (source.author as Record<string, unknown>) : null;
  const authorId = stringOf(source.author_id);
  const included = authorId ? users.get(authorId) : undefined;
  const author =
    stringOf(authorRecord?.screen_name) ||
    stringOf(authorRecord?.username) ||
    stringOf(source.screen_name) ||
    included?.username ||
    (typeof source.author === "string" ? source.author : "");
  const authorName =
    stringOf(source.author_name) ||
    stringOf(source.authorName) ||
    stringOf(authorRecord?.name) ||
    included?.name ||
    author;
  const id = stringOf(source.id) || stringOf(source.id_str) || `bookmark-${index + 1}`;
  const url =
    stringOf(source.url) ||
    stringOf(source.expanded_url) ||
    (id && /^\d{8,}$/.test(id) ? `https://x.com/i/status/${id}` : "");
  const text = stringOf(source.text) || stringOf(source.full_text) || stringOf(source.note);
  const createdAt = stringOf(source.created_at) || stringOf(source.createdAt);
  const title = stringOf(source.title);
  return { id, url, text, author, authorName, createdAt, title };
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
