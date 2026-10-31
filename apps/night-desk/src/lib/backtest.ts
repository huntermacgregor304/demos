import { compounded, maxDrawdown, sharpe } from "@/lib/metrics";
import type { Asset, Bar } from "@/lib/prices";

export const COST = 0.001;
export const IS_FRACTION = 0.6;
export const GATE = {
  minDays: 60,
  minSharpe: 0.4,
  maxDrawdownFloor: -0.35,
  minCompounded: 0,
} as const;

export type Wave = "sine" | "square" | "sawtooth" | "triangle";

export type Day = {
  date: string;
  decisionDate: string;
  sample: "is" | "oos";
  position: number;
  gross: number;
  cost: number;
  net: number;
  close: number;
};

export type WindowMetrics = {
  days: number;
  sharpe: number;
  maxDrawdown: number;
  compounded: number;
  costDrag: number;
};

export type Strategy = {
  id: string;
  name: string;
  asset: Asset;
  instrument: string;
  program: number;
  wave: Wave;
  baseMidi: number;
  positions: (bars: Bar[]) => (number | null)[];
};

export type StrategyResult = Omit<Strategy, "positions"> & {
  days: Day[];
  is: WindowMetrics;
  oos: WindowMetrics;
  pass: boolean;
};

export type Desk = {
  bars: Bar[];
  split: number;
  lastIsDate: string;
  splitDate: string;
  strategies: StrategyResult[];
};

function meanRange(bars: Bar[], asset: Asset, from: number, to: number): number {
  let sum = 0;
  const count = to - from + 1;
  for (let i = from; i <= to; i++) sum += bars[i][asset];
  return sum / count;
}

function stdevRange(bars: Bar[], asset: Asset, from: number, to: number): number {
  const count = to - from + 1;
  if (count < 2) return 0;
  const mu = meanRange(bars, asset, from, to);
  let variance = 0;
  for (let i = from; i <= to; i++) variance += (bars[i][asset] - mu) ** 2;
  return Math.sqrt(variance / (count - 1));
}

function smaCross(asset: Asset, fast: number, slow: number): (bars: Bar[]) => (number | null)[] {
  return (bars) =>
    bars.map((_, t) => {
      if (t + 1 < slow) return null;
      const fastMean = meanRange(bars, asset, t - fast + 1, t);
      const slowMean = meanRange(bars, asset, t - slow + 1, t);
      return fastMean > slowMean ? 1 : 0;
    });
}

function momentum(asset: Asset, window: number): (bars: Bar[]) => (number | null)[] {
  return (bars) =>
    bars.map((_, t) => {
      if (t < window) return null;
      return bars[t][asset] / bars[t - window][asset] - 1 > 0 ? 1 : 0;
    });
}

function meanReversion(asset: Asset, window: number): (bars: Bar[]) => (number | null)[] {
  return (bars) =>
    bars.map((_, t) => {
      if (t + 1 < window) return null;
      const mu = meanRange(bars, asset, t - window + 1, t);
      const sd = stdevRange(bars, asset, t - window + 1, t);
      if (sd === 0) return 0;
      const z = (bars[t][asset] - mu) / sd;
      if (z <= -1) return 1;
      if (z >= 1) return -1;
      return 0;
    });
}

function donchianHold(asset: Asset, window: number): (bars: Bar[]) => (number | null)[] {
  return (bars) => {
    const out: (number | null)[] = bars.map(() => null);
    let position = 0;
    for (let t = window; t < bars.length; t++) {
      let high = -Infinity;
      let low = Infinity;
      for (let j = t - window; j < t; j++) {
        const price = bars[j][asset];
        if (price > high) high = price;
        if (price < low) low = price;
      }
      const price = bars[t][asset];
      if (price >= high) position = 1;
      else if (price <= low) position = 0;
      out[t] = position;
    }
    return out;
  };
}

function dualMomentum(asset: Asset, momWindow: number, smaWindow: number): (bars: Bar[]) => (number | null)[] {
  return (bars) =>
    bars.map((_, t) => {
      if (t < momWindow || t + 1 < smaWindow) return null;
      const change = bars[t][asset] / bars[t - momWindow][asset] - 1;
      const average = meanRange(bars, asset, t - smaWindow + 1, t);
      return change > 0 && bars[t][asset] > average ? 1 : 0;
    });
}

const spyDual = dualMomentum("spy", 60, 50);

export const strategies: Strategy[] = [
  {
    id: "btc_sma_20_50",
    name: "BTC SMA 20/50",
    asset: "btc",
    instrument: "Violin I",
    program: 40,
    wave: "triangle",
    baseMidi: 74,
    positions: smaCross("btc", 20, 50),
  },
  {
    id: "eth_sma_10_30",
    name: "ETH SMA 10/30",
    asset: "eth",
    instrument: "Violin II",
    program: 40,
    wave: "triangle",
    baseMidi: 71,
    positions: smaCross("eth", 10, 30),
  },
  {
    id: "spy_sma_50_200",
    name: "SPY SMA 50/200",
    asset: "spy",
    instrument: "Viola",
    program: 41,
    wave: "sawtooth",
    baseMidi: 67,
    positions: smaCross("spy", 50, 200),
  },
  {
    id: "btc_mom_20",
    name: "BTC 20-day momentum",
    asset: "btc",
    instrument: "Cello",
    program: 42,
    wave: "sawtooth",
    baseMidi: 62,
    positions: momentum("btc", 20),
  },
  {
    id: "eth_mom_10",
    name: "ETH 10-day momentum",
    asset: "eth",
    instrument: "Contrabass",
    program: 43,
    wave: "sine",
    baseMidi: 50,
    positions: momentum("eth", 10),
  },
  {
    id: "spy_mom_60",
    name: "SPY 60-day momentum",
    asset: "spy",
    instrument: "Flute",
    program: 73,
    wave: "sine",
    baseMidi: 78,
    positions: momentum("spy", 60),
  },
  {
    id: "btc_mr_20",
    name: "BTC 20-day mean reversion",
    asset: "btc",
    instrument: "Oboe",
    program: 68,
    wave: "square",
    baseMidi: 70,
    positions: meanReversion("btc", 20),
  },
  {
    id: "eth_mr_20",
    name: "ETH 20-day mean reversion",
    asset: "eth",
    instrument: "Clarinet",
    program: 71,
    wave: "square",
    baseMidi: 64,
    positions: meanReversion("eth", 20),
  },
  {
    id: "spy_mr_20",
    name: "SPY 20-day mean reversion",
    asset: "spy",
    instrument: "Bassoon",
    program: 70,
    wave: "triangle",
    baseMidi: 53,
    positions: meanReversion("spy", 20),
  },
  {
    id: "btc_don_20",
    name: "BTC 20-day Donchian",
    asset: "btc",
    instrument: "Horn",
    program: 60,
    wave: "sawtooth",
    baseMidi: 58,
    positions: donchianHold("btc", 20),
  },
  {
    id: "eth_don_15",
    name: "ETH 15-day Donchian",
    asset: "eth",
    instrument: "Trumpet",
    program: 56,
    wave: "square",
    baseMidi: 72,
    positions: donchianHold("eth", 15),
  },
  {
    id: "spy_dual_60_50",
    name: "SPY dual momentum",
    asset: "spy",
    instrument: "Timpani",
    program: 47,
    wave: "sine",
    baseMidi: 45,
    positions: spyDual,
  },
  {
    id: "btc_risk_on",
    name: "BTC when SPY is risk-on",
    asset: "btc",
    instrument: "Piano",
    program: 0,
    wave: "triangle",
    baseMidi: 60,
    positions: (bars) => spyDual(bars).map((position) => (position === null ? null : position === 1 ? 1 : 0)),
  },
];

export function scoreSeries(bars: Bar[], asset: Asset, positions: (number | null)[], split: number): Day[] {
  const days: Day[] = [];
  let previous = 0;
  for (let t = 0; t < bars.length - 1; t++) {
    const position = positions[t];
    if (position === null) {
      previous = 0;
      continue;
    }
    const close = bars[t][asset];
    const next = bars[t + 1][asset];
    const gross = position * (next / close - 1);
    const cost = Math.abs(position - previous) * COST;
    days.push({
      date: bars[t + 1].date,
      decisionDate: bars[t].date,
      sample: t + 1 >= split ? "oos" : "is",
      position,
      gross,
      cost,
      net: gross - cost,
      close,
    });
    previous = position;
  }
  return days;
}

export function windowMetrics(days: Day[]): WindowMetrics {
  const nets = days.map((day) => day.net);
  return {
    days: days.length,
    sharpe: sharpe(nets),
    maxDrawdown: maxDrawdown(nets),
    compounded: compounded(nets),
    costDrag: days.reduce((sum, day) => sum + day.cost, 0),
  };
}

export function clearsGate(metrics: WindowMetrics): boolean {
  return (
    metrics.days >= GATE.minDays &&
    metrics.sharpe >= GATE.minSharpe &&
    metrics.maxDrawdown >= GATE.maxDrawdownFloor &&
    metrics.compounded > GATE.minCompounded
  );
}

export function runDesk(bars: Bar[]): Desk {
  if (bars.length < 3) throw new Error("Need at least three bars");
  const split = Math.floor(bars.length * IS_FRACTION);
  const results = strategies.map(({ positions, ...strategy }) => {
    const series = positions(bars);
    const days = scoreSeries(bars, strategy.asset, series, split);
    const inside = windowMetrics(days.filter((day) => day.sample === "is"));
    const outside = windowMetrics(days.filter((day) => day.sample === "oos"));
    return { ...strategy, days, is: inside, oos: outside, pass: clearsGate(outside) };
  });
  return {
    bars,
    split,
    lastIsDate: bars[split - 1].date,
    splitDate: bars[split].date,
    strategies: results,
  };
}

export type CurvePoint = { date: string; equity: number };

/** Equal-weight simulated equity of rules that cleared the gate, out of sample. */
export function bookCurve(desk: Desk): CurvePoint[] {
  const live = desk.strategies.filter((strategy) => strategy.pass);
  const maps = live.map((strategy) => new Map(strategy.days.map((day) => [day.date, day.net])));
  const dates = desk.bars.slice(desk.split).map((bar) => bar.date);
  let equity = 1;
  const points: CurvePoint[] = [{ date: desk.lastIsDate, equity: 1 }];
  for (const date of dates) {
    if (live.length === 0) {
      points.push({ date, equity: 1 });
      continue;
    }
    const average = maps.reduce((sum, table) => sum + (table.get(date) ?? 0), 0) / live.length;
    equity *= 1 + average;
    points.push({ date, equity });
  }
  return points;
}
