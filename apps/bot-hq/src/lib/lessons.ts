export type Lesson = {
  id: string;
  n: string;
  title: string;
  tag: string;
  body: string;
};

export function parseLessons(markdown: string): Lesson[] {
  const chunks = markdown.split(/\n(?=## )/).slice(1);
  if (chunks.length === 0) {
    throw new Error("knowledge file has no lessons");
  }

  return chunks.map((chunk, index) => {
    const lines = chunk.replace(/\s+$/, "").split("\n");
    const title = lines[0]?.replace(/^##\s+/, "").trim();
    if (!title) throw new Error("lesson is missing a title");

    const tagLine = lines.find((line) => line.startsWith("tag:"));
    if (!tagLine) throw new Error(`missing tag for ${title}`);
    const tag = tagLine.slice("tag:".length).trim();
    if (!tag) throw new Error(`empty tag for ${title}`);

    const body = lines
      .filter((line) => line !== lines[0] && line !== tagLine)
      .join(" ")
      .trim()
      .replace(/\s+/g, " ");
    if (!body) throw new Error(`missing body for ${title}`);

    return {
      id: tag,
      n: String(index + 1).padStart(2, "0"),
      title,
      tag,
      body,
    };
  });
}
