import type { Desk } from "@/lib/backtest";
import { COST } from "@/lib/backtest";
import type { Asset } from "@/lib/prices";

export type Side = "BUY" | "SELL" | "SHORT" | "COVER";

export type Fill = {
  decisionDate: string;
  strategyId: string;
  strategyName: string;
  asset: Asset;
  from: number;
  to: number;
  side: Side;
  qty: number;
  close: number;
  cost: number;
  kind: "simulated";
};

export function sideFor(from: number, to: number): Side {
  if (to === 0 && from > 0) return "SELL";
  if (to === 0 && from < 0) return "COVER";
  if (to < 0 && to < from) return "SHORT";
  if (to > from) return "BUY";
  return "SELL";
}

export function buildFills(desk: Desk): Fill[] {
  const fills: Fill[] = [];
  for (const strategy of desk.strategies) {
    let previous = 0;
    let seen = false;
    for (const day of strategy.days) {
      if (!seen) {
        seen = true;
        if (day.position !== 0) {
          fills.push(fillFrom(strategy, day.decisionDate, 0, day.position, day.close));
        }
        previous = day.position;
        continue;
      }
      if (day.position !== previous) {
        fills.push(fillFrom(strategy, day.decisionDate, previous, day.position, day.close));
      }
      previous = day.position;
    }
  }
  return fills.sort((a, b) => a.decisionDate.localeCompare(b.decisionDate) || a.strategyId.localeCompare(b.strategyId));
}

function fillFrom(
  strategy: { id: string; name: string; asset: Asset },
  decisionDate: string,
  from: number,
  to: number,
  close: number,
): Fill {
  const qty = Math.abs(to - from);
  return {
    decisionDate,
    strategyId: strategy.id,
    strategyName: strategy.name,
    asset: strategy.asset,
    from,
    to,
    side: sideFor(from, to),
    qty,
    close,
    cost: qty * close * COST,
    kind: "simulated",
  };
}
