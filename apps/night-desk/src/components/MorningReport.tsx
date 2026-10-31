import { DataMark } from "@/components/DataMark";
import { EquityCurve } from "@/components/EquityCurve";
import { PianoRoll } from "@/components/PianoRoll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { bookCurve } from "@/lib/backtest";
import { desk } from "@/lib/desk";
import { money, num, pct } from "@/lib/format";
import { buildScore } from "@/lib/music";
import { citationLine } from "@/lib/prices";

const curve = bookCurve(desk);
const score = buildScore(desk);

export function MorningReport({ active }: { active: boolean }) {
  const passed = desk.strategies.filter((strategy) => strategy.pass);
  const end = curve[curve.length - 1]?.equity ?? 1;
  const last = desk.bars[desk.bars.length - 1];
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <DataMark historical demo />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-magenta">Morning report</p>
          <h2 className="mt-1 font-display text-4xl tracking-wide text-cyan">07:00</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Desk note for the snapshot ending {last.date}. The curve is a demo book on historical closes. It is not a
            forecast and it is not a claim about money.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          BTC {money(last.btc)} · ETH {money(last.eth)} · SPY {money(last.spy)}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Simulated equity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Equal weight of the {passed.length} rules that cleared the gate, from {desk.splitDate}. Rebased to 1.
              Dashed line is 1.
            </p>
          </CardHeader>
          <CardContent>
            <EquityCurve points={curve} />
            <p className="font-mono text-xs text-muted-foreground">
              Curve ends at {num(end, 3)}. Simulated change {pct(end - 1)}. Costs are already in the path.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What cleared</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {passed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rule cleared the gate. The book stays flat at 1.</p>
            ) : (
              passed.map((strategy) => (
                <div key={strategy.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{strategy.name}</span>
                  <span className="font-mono text-xs text-cyan">
                    {strategy.instrument} · Sharpe {num(strategy.oos.sharpe)}
                  </span>
                </div>
              ))
            )}
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              In-sample through {desk.lastIsDate}. Out-of-sample from {desk.splitDate}. Gate: Sharpe ≥ 0.40, drawdown
              not worse than 35%, simulated change above zero, 10 bps turnover.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>13-lane roll</CardTitle>
        </CardHeader>
        <CardContent>
          <PianoRoll score={score} active={active} />
        </CardContent>
      </Card>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{citationLine()}</p>
    </div>
  );
}
