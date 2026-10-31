import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { GATE, bookCurve, runDesk, scoreSeries, strategies } from "../src/lib/backtest";
import { buildDebate } from "../src/lib/debate";
import { bars, desk } from "../src/lib/desk";
import { buildFills } from "../src/lib/fills";
import { money } from "../src/lib/format";
import { compounded, maxDrawdown, sharpe } from "../src/lib/metrics";
import { encodeMidi } from "../src/lib/midi";
import { ROLL_STEPS, buildScore } from "../src/lib/music";
import { citationLine, loadBars, priceCitation } from "../src/lib/prices";
import { llmEndpoint, llmKey } from "../src/server/llm";

describe("prices", () => {
  test("loads a cited BTC, ETH, and SPY snapshot", () => {
    expect(bars.length).toBeGreaterThan(500);
    expect(bars).toEqual(loadBars());
    expect(priceCitation.provider).toContain("Yahoo Finance");
    expect(priceCitation.symbols).toEqual({ btc: "BTC-USD", eth: "ETH-USD", spy: "SPY" });
    expect(priceCitation.fields.spy).toBe("adjclose");
    expect(citationLine()).toContain("BTC-USD");
    expect(bars[0].date).toBe("2021-11-01");
    expect(bars[bars.length - 1].date).toBe("2026-10-30");
    const dates = bars.map((bar) => bar.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
    for (const bar of bars) {
      expect(bar.btc).toBeGreaterThan(0);
      expect(bar.eth).toBeGreaterThan(0);
      expect(bar.spy).toBeGreaterThan(0);
    }
  });
});

describe("metrics", () => {
  test("matches a hand-computed Sharpe and drawdown", () => {
    expect(sharpe([0.01, 0.02])).toBeCloseTo(33.674916, 4);
    expect(sharpe([0.01, -0.01, 0.01, -0.01])).toBeCloseTo(0, 8);
    expect(maxDrawdown([0.1, -0.2, 0.05])).toBeCloseTo(-0.2, 8);
    expect(compounded([0.1, -0.1])).toBeCloseTo(-0.01, 8);
  });

  test("charges 10 bps when a unit is put on and nothing when it is held", () => {
    const sample = [
      { date: "2024-01-01", btc: 100, eth: 1, spy: 1 },
      { date: "2024-01-02", btc: 100, eth: 1, spy: 1 },
      { date: "2024-01-03", btc: 110, eth: 1, spy: 1 },
    ];
    const days = scoreSeries(sample, "btc", [1, 1, 1], 2);
    expect(days[0].cost).toBeCloseTo(0.001, 8);
    expect(days[0].net).toBeCloseTo(-0.001, 8);
    expect(days[1].cost).toBeCloseTo(0, 8);
    expect(days[1].gross).toBeCloseTo(0.1, 8);
    expect(days[1].net).toBeCloseTo(0.1, 8);
    expect(days[0].sample).toBe("is");
    expect(days[1].sample).toBe("oos");
  });
});

describe("backtest", () => {
  test("does not look ahead of the decision close", () => {
    const index = 400;
    for (const strategy of strategies) {
      const original = strategy.positions(bars)[index];
      const mutated = bars.map((bar, i) => (i === index + 1 ? { ...bar, btc: bar.btc * 5, eth: bar.eth * 5, spy: bar.spy * 5 } : bar));
      expect(strategy.positions(mutated)[index]).toBe(original);
      expect(strategy.positions(bars.slice(0, index + 1))[index]).toBe(original);
    }
  });

  test("splits the book and applies the demo gate", () => {
    expect(desk.splitDate > desk.lastIsDate).toBe(true);
    expect(desk.strategies).toHaveLength(13);
    const ids = desk.strategies.map((strategy) => strategy.id);
    expect(new Set(ids).size).toBe(13);
    let passes = 0;
    let fails = 0;
    for (const strategy of desk.strategies) {
      const outside = strategy.days.filter((day) => day.sample === "oos");
      const inside = strategy.days.filter((day) => day.sample === "is");
      expect(outside.length).toBe(strategy.oos.days);
      expect(inside.length).toBe(strategy.is.days);
      expect(outside.every((day) => day.date >= desk.splitDate)).toBe(true);
      expect(inside.every((day) => day.date < desk.splitDate)).toBe(true);
      const cleared =
        strategy.oos.days >= GATE.minDays &&
        strategy.oos.sharpe >= GATE.minSharpe &&
        strategy.oos.maxDrawdown >= GATE.maxDrawdownFloor &&
        strategy.oos.compounded > GATE.minCompounded;
      expect(strategy.pass).toBe(cleared);
      expect(strategy.oos.costDrag).toBeGreaterThan(0);
      if (strategy.pass) passes += 1;
      else fails += 1;
    }
    expect(passes).toBeGreaterThan(0);
    expect(fails).toBeGreaterThan(0);
    expect(desk.strategies.find((strategy) => strategy.id === "spy_mr_20")?.pass).toBe(false);
  });

  test("builds a book curve that starts at 1", () => {
    const curve = bookCurve(desk);
    expect(curve[0].equity).toBe(1);
    expect(curve.length).toBeGreaterThan(100);
    expect(curve[curve.length - 1].date).toBe(bars[bars.length - 1].date);
  });
});

describe("debate and fills", () => {
  test("speaks from the snapshot with every seat and no broker", () => {
    const lines = buildDebate(desk);
    expect(JSON.stringify(lines)).toBe(JSON.stringify(buildDebate(desk)));
    expect(new Set(lines.map((line) => line.name))).toEqual(new Set(["NOVA", "NYX", "ORION", "VELA", "KADE", "ZARA"]));
    expect(lines.map((line) => line.role)).toContain("analyst");
    expect(lines.map((line) => line.role)).toContain("bull");
    expect(lines.map((line) => line.role)).toContain("bear");
    expect(lines.map((line) => line.role)).toContain("risk");
    const text = lines.map((line) => line.text).join(" ");
    expect(text).toContain("PAPER ONLY");
    expect(text).toContain("No broker");
    expect(text).toContain(money(bars[bars.length - 1].btc));
    expect(text.toLowerCase()).not.toContain("guaranteed");
    expect(text.toLowerCase()).not.toContain("will make");
  });

  test("logs simulated fills at the historical decision close", () => {
    const fills = buildFills(desk);
    expect(fills.length).toBeGreaterThan(10);
    const byDate = new Map(bars.map((bar) => [bar.date, bar]));
    for (const fill of fills) {
      expect(fill.kind).toBe("simulated");
      expect(fill.close).toBe(byDate.get(fill.decisionDate)?.[fill.asset]);
      expect(fill.qty).toBeGreaterThan(0);
      expect(["BUY", "SELL", "SHORT", "COVER"]).toContain(fill.side);
    }
  });
});

describe("music", () => {
  test("keeps 13 lanes and sounds only the rules that cleared", () => {
    const score = buildScore(desk);
    expect(score.lanes).toHaveLength(13);
    expect(score.steps).toBe(ROLL_STEPS);
    let sounded = 0;
    for (const lane of score.lanes) {
      const strategy = desk.strategies.find((item) => item.id === lane.strategyId);
      expect(lane.pass).toBe(strategy?.pass);
      if (!lane.pass) expect(lane.notes).toHaveLength(0);
      else sounded += lane.notes.length;
      for (const note of lane.notes) {
        expect(note.step).toBeGreaterThanOrEqual(0);
        expect(note.step).toBeLessThan(ROLL_STEPS);
        expect(note.midi).toBeGreaterThan(20);
        expect(note.midi).toBeLessThan(120);
      }
    }
    expect(sounded).toBeGreaterThan(0);
    const bytes = encodeMidi(score.lanes);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("MThd");
    expect(bytes[8]).toBe(0);
    expect(bytes[9]).toBe(1);
    expect((bytes[10] << 8) | bytes[11]).toBe(13);
    const body = Buffer.from(bytes).toString("latin1");
    expect(body.match(/MTrk/g)?.length).toBe(13);
  });
});

describe("guards", () => {
  test("reads an LLM key only from the environment object", () => {
    expect(llmKey({})).toBeNull();
    expect(llmKey({ NIGHT_DESK_LLM_API_KEY: "  " })).toBeNull();
    expect(llmKey({ NIGHT_DESK_LLM_API_KEY: "test-key" })).toBe("test-key");
    expect(llmEndpoint({}).url).toBe("https://api.openai.com/v1/chat/completions");
    expect(llmEndpoint({ NIGHT_DESK_LLM_BASE_URL: "https://example.test/v1/" }).url).toBe(
      "https://example.test/v1/chat/completions",
    );
  });

  test("keeps the disclaimer, panel labels, and bookmarks, and stays off brokers", () => {
    const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
    const disclaimer = readFileSync(join(root, "src/components/Disclaimer.tsx"), "utf8");
    expect(disclaimer).toContain("PAPER ONLY");
    expect(disclaimer).toContain("not sent to any broker");
    expect(disclaimer).toContain("makes money");
    const mark = readFileSync(join(root, "src/components/DataMark.tsx"), "utf8");
    expect(mark).toContain("Historical data");
    expect(mark).toContain("Demo data");
    const app = readFileSync(join(root, "src/App.tsx"), "utf8");
    expect(app).toContain("<Disclaimer");
    for (const panel of ["WarRoom.tsx", "Backtests.tsx", "PaperLog.tsx", "MorningReport.tsx"]) {
      const source = readFileSync(join(root, "src/components", panel), "utf8");
      expect(source).toContain("<DataMark");
    }
    const bookmarks = JSON.parse(readFileSync(new URL("../../../tracking/seen-bookmarks.json", import.meta.url), "utf8")) as {
      picks: { inspiration?: string[] }[];
    };
    const urls = bookmarks.picks.flatMap((pick) => pick.inspiration ?? []);
    for (const url of [
      "https://x.com/imryven/status/2115936477171392905",
      "https://x.com/gusik4ever/status/2116504471907791240",
      "https://x.com/Shelpid_WI3M/status/2116162631308333402",
      "https://x.com/SimonGFarmer/status/2116193665949606339",
      "https://x.com/0x_fokki/status/2116289885870981296",
    ]) {
      expect(urls).toContain(url);
    }
    const bundled = walk(join(root, "src")).join("\n");
    expect(bundled).not.toMatch(/alpaca|ccxt|binance|placeOrder|interactive brokers/i);
    expect(bundled).not.toMatch(/sk-[A-Za-z0-9]{12,}/);
    const client = walk(join(root, "src/components")).join("\n");
    expect(client).not.toContain("process.env");
  });
});

function walk(folder: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(folder)) {
    const full = join(folder, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) files.push(readFileSync(full, "utf8"));
  }
  return files;
}

describe("desk rerun", () => {
  test("agrees with a fresh run", () => {
    const again = runDesk(bars);
    expect(again.strategies.map((strategy) => strategy.pass)).toEqual(desk.strategies.map((strategy) => strategy.pass));
  });
});
