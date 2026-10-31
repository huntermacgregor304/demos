import snapshot from "@/data/closes.json";

export type Asset = "btc" | "eth" | "spy";

export type Bar = {
  date: string;
  btc: number;
  eth: number;
  spy: number;
};

export type PriceSnapshot = {
  provider: string;
  endpoint: string;
  retrieved: string;
  symbols: Record<Asset, string>;
  fields: Record<Asset, string>;
  alignment: string;
  note: string;
  bars: Bar[];
};

const data = snapshot as PriceSnapshot;

export const priceCitation = {
  provider: data.provider,
  endpoint: data.endpoint,
  retrieved: data.retrieved,
  symbols: data.symbols,
  fields: data.fields,
  alignment: data.alignment,
  note: data.note,
};

export function citationLine(): string {
  return `${data.provider}, retrieved ${data.retrieved}. ${data.symbols.btc} ${data.fields.btc}, ${data.symbols.eth} ${data.fields.eth}, ${data.symbols.spy} ${data.fields.spy}. ${data.note}`;
}

export function loadBars(): Bar[] {
  return data.bars.map((bar) => ({
    date: bar.date,
    btc: bar.btc,
    eth: bar.eth,
    spy: bar.spy,
  }));
}
