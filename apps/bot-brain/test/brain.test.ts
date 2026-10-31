import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { literals } from "../src/claims/literals";
import { llmAdvice } from "../src/claims/llm";
import { parseBookmarks } from "../src/ingest/bookmarks";
import { DEFAULT_DECISIONS, DEFAULT_KNOWLEDGE, fixturePath, resolveInputs } from "../src/ingest/resolve";
import { layoutGraph } from "../src/graph/layout";
import { buildVault } from "../src/wiki/build";

function tempVault() {
  return path.join(mkdtempSync(path.join(tmpdir(), "bot-brain-")), "vault");
}

function buildFixtures() {
  const bookmarks = readFileSync(fixturePath("bookmarks.json"), "utf8");
  const knowledge = readFileSync(fixturePath("KNOWLEDGE.md"), "utf8");
  const decisions = readFileSync(fixturePath("DECISIONS.md"), "utf8");
  const result = buildVault({
    bookmarksPath: fixturePath("bookmarks.json"),
    knowledgePath: fixturePath("KNOWLEDGE.md"),
    decisionsPath: fixturePath("DECISIONS.md"),
    vaultDir: tempVault(),
    origins: { bookmarks: "fixture", knowledge: "fixture", decisions: "fixture" },
  });
  expect(readFileSync(fixturePath("bookmarks.json"), "utf8")).toBe(bookmarks);
  expect(readFileSync(fixturePath("KNOWLEDGE.md"), "utf8")).toBe(knowledge);
  expect(readFileSync(fixturePath("DECISIONS.md"), "utf8")).toBe(decisions);
  return result;
}

describe("bookmarks parser", () => {
  test("reads an object, an array, and a Twitter archive assignment", () => {
    const fromObject = parseBookmarks(readFileSync(fixturePath("bookmarks.json"), "utf8"));
    expect(fromObject[0]?.url).toBe("https://x.com/imryven/status/2115936477171392905");
    const fromArray = parseBookmarks(
      JSON.stringify([{ id: "1", text: "Hello from a raw array of bookmarks.", url: "https://example.com/a", author: "ada" }]),
    );
    expect(fromArray).toHaveLength(1);
    expect(fromArray[0]?.author).toBe("ada");
    const archive = `window.YTD.bookmark.part0 = [ { "bookmark": { "url": "https://x.com/i/status/123456789012345" } } ];`;
    const fromArchive = parseBookmarks(archive);
    expect(fromArchive[0]?.url).toContain("123456789012345");
  });
});

describe("literals", () => {
  test("keeps specific numbers and ignores small integers", () => {
    expect(literals("Clip Editor has 42K queued renders.")).toContain("42K");
    expect(literals("these 10 repos")).not.toContain("10");
    expect(literals("on 2026-10-28")).toContain("2026-10-28");
  });
});

describe("vault", () => {
  test("ingests fixtures into a linked wiki and claim-checks locally", () => {
    const result = buildFixtures();
    const claims = result.claims;
    const text = (part: string) => claims.find((claim) => claim.text.includes(part));

    expect(result.evidence.engine).toBe("karpathy-llm-wiki");
    expect(result.evidence.suspects).toEqual([]);
    expect(result.evidence.errors).toEqual([]);
    expect(result.evidence.unreferenced).toEqual([]);
    expect(result.brokenLinks).toEqual([]);

    const ryven = text("link them into a wiki");
    expect(ryven?.status).toBe("sourced");
    expect(ryven?.sourceLabel).toBe("https://x.com/imryven/status/2115936477171392905");

    const clip = text("reports to YT Master");
    expect(clip?.status).toBe("sourced");
    expect(clip?.sourceLabel).toBe("https://example.com/council/clip-editor");

    const reporting = text("Keep Clip Editor reporting");
    expect(reporting?.status).toBe("sourced");
    expect(reporting?.sourceLabel).toBe("[[Bot Council Knowledge]]");

    const loop = text("stay a loop");
    expect(loop?.status).toBe("unverified");

    const queued = text("42K");
    expect(queued?.status).toBe("unverified");
    expect(queued?.reason).toContain("42K");

    const memory = text("HUD sidebar");
    expect(memory?.status).toBe("unverified");
    expect(memory?.reason).toBe("no source link");

    expect(result.graph.summary.sourced).toBeGreaterThan(0);
    expect(result.graph.summary.unverified).toBeGreaterThan(0);
    expect(result.graph.edges.length).toBeGreaterThan(3);
    expect(result.graph.notes["Claims Report"]).toContain("**unverified**");
    expect(result.graph.notes["Tanner Loop"]).toContain("[[");
    expect(result.graph.nodes.some((node) => node.claimStatus === "unverified")).toBe(true);
    expect(result.graph.nodes.some((node) => node.claimStatus === "sourced")).toBe(true);
  });

  test("falls back to fixtures when the default files are missing", () => {
    const resolved = resolveInputs([], {});
    if (!existsSync(DEFAULT_KNOWLEDGE)) expect(resolved.knowledge.kind).toBe("fixture");
    if (!existsSync(DEFAULT_DECISIONS)) expect(resolved.decisions.kind).toBe("fixture");
    expect(resolved.bookmarks.kind).toBe("fixture");
  });
});

describe("graph layout", () => {
  test("is deterministic and finite", () => {
    const nodes = [
      { id: "A", title: "A", group: "bookmark", claimStatus: "sourced" as const, path: "a" },
      { id: "B", title: "B", group: "decision", claimStatus: "unverified" as const, path: "b" },
    ];
    const edges = [{ source: "A", target: "B" }];
    const once = layoutGraph(nodes, edges, 800, 600);
    const twice = layoutGraph(nodes, edges, 800, 600);
    expect(once).toEqual(twice);
    expect(Number.isFinite(once.A?.x)).toBe(true);
    expect(Number.isFinite(once.B?.y)).toBe(true);
  });
});

describe("llm mode", () => {
  test("does not call out when no key is set", async () => {
    const previous = process.env.BOT_BRAIN_LLM_API_KEY;
    const previousOpen = process.env.OPENAI_API_KEY;
    delete process.env.BOT_BRAIN_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const note = await llmAdvice([]);
    expect(note).toContain("Local verdicts were kept");
    if (previous) process.env.BOT_BRAIN_LLM_API_KEY = previous;
    if (previousOpen) process.env.OPENAI_API_KEY = previousOpen;
  });
});
