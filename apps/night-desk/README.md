# Night Desk

A paper-only overnight desk. Six agents debate a frozen snapshot of daily BTC, ETH, and SPY closes. Rules are backtested with turnover costs and an in-sample / out-of-sample split. The 7 AM note draws the simulated book and plays a 13-lane roll.

PAPER ONLY. Simulated fills are not orders. Nothing here is a recommendation or a claim that a rule makes money.

Prices: Yahoo Finance chart API, retrieved 2026-10-31. `BTC-USD` close, `ETH-USD` close, `SPY` adjusted close. Inner-joined on SPY sessions, 2021-11-01 through 2026-10-30. The file is `src/data/closes.json`. The app does not fetch prices.

## Run

```bash
cd apps/night-desk && bun install && bun run dev
```

Open http://localhost:3000.

Optional LLM rewrite reads `NIGHT_DESK_LLM_API_KEY` from the server environment only. Leave it unset and the debate stays on the local rules. See `.env.example`. No secrets belong in the repo.
