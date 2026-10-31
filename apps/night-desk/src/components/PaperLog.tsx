import { DataMark } from "@/components/DataMark";
import { Badge } from "@/components/ui/badge";
import { desk } from "@/lib/desk";
import { buildFills, type Side } from "@/lib/fills";
import { assetLabel, money, num } from "@/lib/format";

const sideVariant: Record<Side, "cyan" | "magenta"> = {
  BUY: "cyan",
  COVER: "cyan",
  SELL: "magenta",
  SHORT: "magenta",
};

export function PaperLog() {
  const fills = buildFills(desk).slice(-40).reverse();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:px-6">
      <div>
        <DataMark historical demo />
        <h2 className="mt-3 font-display text-2xl tracking-wide">Paper log</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Simulated fills at historical closes. Nothing in this list was sent to a venue. One paper unit is a weight,
          not a share.
        </p>
      </div>
      <div className="glass-panel overflow-x-auto rounded-xl">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <tr className="border-b border-cyan/20">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Rule</th>
              <th className="px-3 py-3 font-medium">Side</th>
              <th className="px-3 py-3 font-medium">Asset</th>
              <th className="px-3 py-3 font-medium">Qty</th>
              <th className="px-3 py-3 font-medium">Historical close</th>
              <th className="px-3 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Mark</th>
            </tr>
          </thead>
          <tbody>
            {fills.map((fill) => (
              <tr key={`${fill.decisionDate}-${fill.strategyId}-${fill.side}-${fill.to}`} className="border-b border-white/5">
                <td className="px-4 py-2.5 font-mono text-xs">{fill.decisionDate}</td>
                <td className="px-3 py-2.5">{fill.strategyName}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={sideVariant[fill.side]}>{fill.side}</Badge>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{assetLabel(fill.asset)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{num(fill.qty, 0)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{money(fill.close)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{money(fill.cost)}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-magenta">Demo fill</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
