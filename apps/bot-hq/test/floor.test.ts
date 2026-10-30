import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildEnergyField } from "../src/components/space/fieldGeometry";
import { handoffRoute, labelBoxesClear, minSeparation, nameLabels, orbs, SCENE } from "../src/lib/constellation";
import { bots, getBot, loopOrder, relationshipLines } from "../src/data/bots";
import { handoffs, stageVisual, stages } from "../src/data/handoffs";
import { parseLessons } from "../src/lib/lessons";
import { playbookRoles, suggestNextBot, type PlaybookRole } from "../src/lib/coverage";

const srcRoot = new URL("../src", import.meta.url);

describe("roster", () => {
  test("lists every named bot once, with a job", () => {
    expect(bots).toHaveLength(22);
    expect(new Set(bots.map((bot) => bot.id)).size).toBe(bots.length);
    for (const bot of bots) {
      expect(bot.job.trim().length).toBeGreaterThan(0);
      expect(bot.standingOrder.trim().length).toBeGreaterThan(0);
    }
  });

  test("nests Clip Editor under YT Master", () => {
    expect(getBot("clip-editor").reportsTo).toBe("yt-master");
    expect(getBot("yt-master").directs).toContain("clip-editor");
    expect(relationshipLines(getBot("clip-editor")).join(" ")).toContain("Reports to YT Master");
  });

  test("keeps the planner, doer, critic loop in order", () => {
    expect(loopOrder).toEqual(["tanner", "dude", "kyle"]);
    for (const id of loopOrder) {
      expect(getBot(id).loop).toBe(true);
      expect(relationshipLines(getBot(id)).join(" ")).toContain("then it repeats");
    }
  });

  test("keeps King Jr as advice only and Queen as staff", () => {
    expect(getBot("king-jr").advisesOnly).toBe(true);
    expect(getBot("king-jr").job.toLowerCase()).toContain("advises only");
    expect(getBot("queen").staffTo).toBe("goku");
  });
});

describe("constellation", () => {
  test("places every bot once, clear of its neighbors and inside the frame", () => {
    expect(orbs).toHaveLength(bots.length);
    expect(new Set(orbs.map((orb) => orb.id))).toEqual(new Set(bots.map((bot) => bot.id)));
    expect(minSeparation(orbs)).toBeGreaterThan(70);
    expect(minSeparation(nameLabels)).toBeGreaterThan(36);
    expect(labelBoxesClear()).toBe(true);
    for (const orb of orbs) {
      expect(orb.x).toBeGreaterThan(36);
      expect(orb.y).toBeGreaterThan(36);
      expect(orb.x).toBeLessThan(SCENE.width - 36);
      expect(orb.y).toBeLessThan(SCENE.height - 36);
    }
  });

  test("runs the handoff pulse from the scout through Hunter to Builder", () => {
    const shipped = handoffRoute("talk-to-the-feed");
    const building = handoffRoute("bot-hq");
    expect(shipped.path.startsWith("M")).toBe(true);
    expect(shipped.label).toBe("PR #1");
    expect(shipped.marker).toBe("shipped");
    expect(building.marker).toBe("building");
    expect(shipped.path).toContain(String(SCENE.cx));
    expect(minSeparation([shipped.end, ...orbs])).toBeGreaterThan(36);
  });
});

describe("energy field", () => {
  test("builds a vortex of luminous threads around the globe", () => {
    const field = buildEnergyField();
    expect(field.positions.length).toBeGreaterThan(20000);
    expect(field.colors.length).toBe(field.positions.length);
    expect(field.along.length).toBe(field.positions.length / 3);
    expect(field.pathCount).toBeGreaterThan(100);
    expect(field.paths.length).toBe(field.pathCount * field.pathLength * 3);
  });
});

describe("handoffs", () => {
  test("runs scout, approval, builder, shipped", () => {
    expect(stages.map((stage) => stage.id)).toEqual(["scout", "approval", "builder", "shipped"]);
  });

  test("records Talk to the Feed on PR 1, waiting on live keys", () => {
    const pick = handoffs.find((item) => item.id === "talk-to-the-feed");
    expect(pick?.kicker).toBe("Grok Voice 3.0");
    expect(pick?.app).toBe("apps/talk-to-the-feed");
    expect(pick?.pr).toBe(1);
    expect(pick?.stage).toBe("shipped");
    expect(pick?.hold).toMatch(/live keys/i);
    expect(stageVisual(pick!, "shipped")).toBe("held");
    expect(stageVisual(pick!, "builder")).toBe("done");
  });

  test("records Bot HQ as building, with the livestream sources", () => {
    const pick = handoffs.find((item) => item.id === "bot-hq");
    expect(pick?.stage).toBe("builder");
    expect(pick?.app).toBe("apps/bot-hq");
    expect(stageVisual(pick!, "builder")).toBe("current");
    expect(stageVisual(pick!, "shipped")).toBe("upcoming");
    const sources = pick?.events.flatMap((event) => event.sources ?? []);
    expect(sources).toContain("https://x.com/spectnfa/status/2113646397379469654");
    expect(sources).toContain("https://x.com/i/status/2112574886421901822");
  });
});

describe("lessons", () => {
  test("parses the bundled knowledge file", async () => {
    const markdown = await Bun.file(new URL("../src/data/knowledge.sample.md", import.meta.url)).text();
    const lessons = parseLessons(markdown);
    const blob = lessons.map((lesson) => `${lesson.title} ${lesson.body}`).join("\n");
    expect(blob).toContain("Cursor app");
    expect(blob).toContain("cannot be forwarded");
    expect(blob).toContain("owner directly");
    expect(blob).toContain("server-side");
    expect(lessons.map((lesson) => lesson.tag)).toEqual(["access", "secrets", "approval", "keys", "playbook"]);
  });
});

describe("missing bot", () => {
  test("suggests Sentinel for the open ops seat", () => {
    const next = suggestNextBot();
    expect(next.name).toBe("Sentinel");
    expect(next.roleId).toBe("ops");
    expect(next.reason).toMatch(/PR #1/);
    expect(next.reason.toLowerCase()).toMatch(/keys/);
    expect(playbookRoles.find((role) => role.id === "ops")?.coverage).toBe("open");
    expect(playbookRoles.find((role) => role.id === "support")?.coverage).toBe("open");
  });

  test("moves to support when ops is covered", () => {
    const roles: PlaybookRole[] = playbookRoles.map((role) => (role.id === "ops" ? { ...role, coverage: "covered" } : role));
    expect(suggestNextBot(roles).name).toBe("Liaison");
  });
});

describe("seen bookmarks", () => {
  test("lists both picks at the repo root", async () => {
    const file = Bun.file(new URL("../../../tracking/seen-bookmarks.json", import.meta.url));
    const data = (await file.json()) as {
      picks: { title: string; demo: string; app: string; inspiration?: string[] }[];
    };
    const voice = data.picks.find((pick) => pick.title === "Grok Voice 3.0");
    const hq = data.picks.find((pick) => pick.title === "Bot HQ");
    expect(voice?.demo).toBe("Talk to the Feed");
    expect(voice?.app).toBe("apps/talk-to-the-feed");
    expect(hq?.app).toBe("apps/bot-hq");
    expect(hq?.inspiration).toEqual([
      "https://x.com/spectnfa/status/2113646397379469654",
      "https://x.com/i/status/2112574886421901822",
    ]);
  });
});

describe("network", () => {
  test("has no client calls in the app source", () => {
    const files = walk(fileUrl(srcRoot));
    const offenders: string[] = [];
    for (const file of files) {
      if (!/\.(ts|tsx|css|md)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      if (/\bfetch\s*\(/.test(text) || /XMLHttpRequest/.test(text) || /new WebSocket/.test(text) || /EventSource/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function fileUrl(url: URL): string {
  return url.pathname;
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}
