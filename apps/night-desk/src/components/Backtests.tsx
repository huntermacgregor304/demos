import { DataMark } from "@/components/DataMark";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day } from "@/lib/backtest";
import { desk } from "@/lib/desk";
import { assetLabel, num, pct } from "@/lib/format";
import { citationLine } from "@/lib/prices";

function Spark({ days }: { days: Day[] }) {
  const outside = days.filter((day) => day.sample === "oos");
  if (outside.length < 2) return null;
  let equity = 1;
  const points = outside.map((day) => {
    equity *= 1 + day.net;
    return equity;
  });
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 120;
      const y = 28 - ((value - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 120 32" className="mt-3 h-8 w-full" role="img" aria-label="Out-of-sample simulated equity">
      <path d={path} fill="none" stroke="#3EF0FF" strokeWidth="1.4" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

export function Backtests() {
  const passed = desk.strategies.filter((strategy) => strategy.pass).length;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <DataMark historical demo />
          <h2 className="mt-3 font-display text-2xl tracking-wide">Backtests</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Prices are the frozen snapshot. Rules, costs, and the gate are demo construction. {passed} of{" "}
            {desk.strategies.length} cleared the out-of-sample gate. A pass is not a forecast.
          </p>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          Split {desk.lastIsDate} / {desk.splitDate} · 10 bps per unit turned
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {desk.strategies.map((strategy) => (
          <Card key={strategy.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{strategy.name}</CardTitle>
                <Badge variant={strategy.pass ? "cyan" : "magenta"}>{strategy.pass ? "Pass" : "Fail"}</Badge>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {assetLabel(strategy.asset)} · {strategy.instrument} · {strategy.pass ? "lane plays" : "lane silent"}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="In-sample Sharpe" value={num(strategy.is.sharpe)} />
                <Stat label="Out-of-sample Sharpe" value={num(strategy.oos.sharpe)} />
                <Stat label="In-sample max DD" value={pct(strategy.is.maxDrawdown)} />
                <Stat label="Out-of-sample max DD" value={pct(strategy.oos.maxDrawdown)} />
                <Stat label="In-sample simulated" value={pct(strategy.is.compounded)} />
                <Stat label="Out-of-sample simulated" value={pct(strategy.oos.compounded)} />
                <Stat label="In-sample cost drag" value={pct(strategy.is.costDrag)} />
                <Stat label="Out-of-sample cost drag" value={pct(strategy.oos.costDrag)} />
              </div>
              <Spark days={strategy.days} />
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                Demo gate on the out-of-sample window only. Trading costs are inside every figure.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{citationLine()}</p>
    </div>
  );
}
