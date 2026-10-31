export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Annualized Sharpe. Sample standard deviation, 252 periods, risk-free rate 0. */
export function sharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mu = mean(returns);
  const variance = returns.reduce((sum, value) => sum + (value - mu) ** 2, 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (mu / sd) * Math.sqrt(252);
}

/** Most severe peak-to-trough of compounded equity. Zero or negative. */
export function maxDrawdown(returns: number[]): number {
  let equity = 1;
  let peak = 1;
  let worst = 0;
  for (const value of returns) {
    equity *= 1 + value;
    if (equity > peak) peak = equity;
    const drawdown = equity / peak - 1;
    if (drawdown < worst) worst = drawdown;
  }
  return worst;
}

export function compounded(returns: number[]): number {
  return returns.reduce((equity, value) => equity * (1 + value), 1) - 1;
}
