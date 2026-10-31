import { runDesk, type Desk } from "@/lib/backtest";
import { loadBars } from "@/lib/prices";

export const bars = loadBars();
export const desk: Desk = runDesk(bars);
