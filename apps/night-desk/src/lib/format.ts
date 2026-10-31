export function money(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(value: number, digits = 1): string {
  const body = (value * 100).toFixed(digits);
  return value > 0 ? `+${body}%` : `${body}%`;
}

export function num(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function assetLabel(asset: "btc" | "eth" | "spy"): string {
  if (asset === "spy") return "SPY";
  return asset.toUpperCase();
}
