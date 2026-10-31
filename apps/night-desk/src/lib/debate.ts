import { agents, type Role } from "@/data/agents";
import type { Desk, StrategyResult } from "@/lib/backtest";
import { buildFills } from "@/lib/fills";
import { assetLabel, money, num, pct } from "@/lib/format";
import type { Asset, Bar } from "@/lib/prices";

export type DebateLine = {
  agentId: string;
  name: string;
  role: Role;
  text: string;
};

function trailingReturn(bars: Bar[], asset: Asset, window: number): number {
  const last = bars.length - 1;
  return bars[last][asset] / bars[last - window][asset] - 1;
}

function realizedVol(bars: Bar[], asset: Asset, window: number): number {
  const values: number[] = [];
  const last = bars.length - 1;
  for (let i = last - window + 1; i <= last; i++) {
    values.push(bars[i][asset] / bars[i - 1][asset] - 1);
  }
  const mu = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function line(id: string, text: string): DebateLine {
  const agent = agents.find((item) => item.id === id);
  if (!agent) throw new Error(id);
  return { agentId: agent.id, name: agent.name, role: agent.role, text };
}

function bestPass(strategies: StrategyResult[]): StrategyResult | undefined {
  return strategies.filter((strategy) => strategy.pass).sort((a, b) => b.oos.sharpe - a.oos.sharpe)[0];
}

function worstFail(strategies: StrategyResult[]): StrategyResult | undefined {
  return strategies.filter((strategy) => !strategy.pass).sort((a, b) => a.oos.maxDrawdown - b.oos.maxDrawdown)[0];
}

export function buildDebate(desk: Desk): DebateLine[] {
  const { bars, strategies } = desk;
  const last = bars[bars.length - 1];
  const btc20 = trailingReturn(bars, "btc", 20);
  const eth20 = trailingReturn(bars, "eth", 20);
  const spy20 = trailingReturn(bars, "spy", 20);
  const vol = realizedVol(bars, "btc", 20);
  const passed = strategies.filter((strategy) => strategy.pass);
  const best = bestPass(strategies);
  const worst = worstFail(strategies);
  const fills = buildFills(desk);
  const lastFill = fills[fills.length - 1];
  const sameWay = spy20 > 0 === btc20 > 0;

  return [
    line(
      "nova",
      `Snapshot ${last.date}. BTC ${money(last.btc)}, ETH ${money(last.eth)}, SPY ${money(last.spy)}. BTC 20-day change ${pct(btc20)}. 20-day vol ${pct(vol, 0)} annualized. A read of the file, not a forecast.`,
    ),
    line(
      "nyx",
      `Same 20 days: ETH ${pct(eth20)}, SPY ${pct(spy20)}. ${sameWay ? "SPY and BTC moved the same way." : "SPY and BTC diverged."} I compare the snapshot. I do not extend it.`,
    ),
    line(
      "orion",
      best
        ? `${best.name} cleared the demo gate. Out-of-sample simulated Sharpe ${num(best.oos.sharpe)}, drawdown ${pct(best.oos.maxDrawdown)}, after 10 bps a turn. It can sit in the paper book.`
        : "No rule cleared the gate. I will not invent a long for the paper book.",
    ),
    line(
      "vela",
      worst
        ? `${worst.name} missed. Out-of-sample drawdown ${pct(worst.oos.maxDrawdown)}, simulated Sharpe ${num(worst.oos.sharpe)}. In-sample Sharpe was ${num(worst.is.sharpe)}. The training window is not the test.`
        : "Nothing missed the gate. I do not trust a clean sweep. Recheck the split.",
    ),
    line(
      "kade",
      `${passed.length} of ${strategies.length} cleared. Gate: out-of-sample Sharpe at least 0.40, drawdown not worse than 35%, simulated change above zero, costs included. The rest stay out.`,
    ),
    line(
      "zara",
      lastFill
        ? `Latest simulated fill: ${lastFill.side} ${num(lastFill.qty, 0)} ${assetLabel(lastFill.asset)} at ${money(lastFill.close)} on ${lastFill.decisionDate}. Charge ${money(lastFill.cost)}. PAPER ONLY. No broker.`
        : "No simulated fills on this snapshot. PAPER ONLY. No broker.",
    ),
    line(
      "orion",
      `In-sample ends ${desk.lastIsDate}. Out-of-sample starts ${desk.splitDate}. I argue from the second window only.`,
    ),
    line(
      "vela",
      "Ten basis points on every position change. High-turnover rules pay that on each flip. I do not cheer a move that ignores the charge.",
    ),
    line(
      "kade",
      "The morning book is equal weight across rules that passed. One paper unit is a weight, not a share, and not an order.",
    ),
    line(
      "nova",
      "Hand it to the 7 AM note. Equity curve of the paper book, and 13 lanes. A silent lane failed the gate.",
    ),
  ];
}

export function debateFacts(desk: Desk): string {
  return buildDebate(desk)
    .map((item) => `${item.name} (${item.role}): ${item.text}`)
    .join("\n");
}
