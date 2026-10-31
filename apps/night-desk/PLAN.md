# Night Desk plan

There is no in-repo planning skill. Fetched `origin/main` and `origin/cursor/bot-brain-d8f8` before this note. The only `SKILL.md` in the repo is the vendored Obsidian markdown skill on the Bot Brain branch. `apps/bot-brain/PLAN.md` is the in-repo precedent (overview, what we reuse, behaviour, risks), and this file follows that shape. It was written before the Night Desk implementation.

## Overview

Night Desk is a paper-only overnight quant desk in `apps/night-desk`. Six named agents sit around a three.js table and debate from deterministic templates filled with a frozen daily-price snapshot. Thirteen simple rules are backtested on that snapshot with turnover costs and an in-sample / out-of-sample split. Rules that clear a fixed gate show up as instrument lanes on a 13-lane piano roll in a 7 AM report, next to a simulated equity curve and a log of simulated fills.

Nothing here places an order, connects to a broker, or claims that a rule will make money.

One command runs it: `cd apps/night-desk && bun install && bun run dev`.

## What we reuse

Ideas, not copied trading code.

- [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) (Apache-2.0) is a Python multi-agent LLM desk: analysts, a bull researcher, a bear researcher, and a risk team, with decisions scored on closes and a simulated exchange. We do not vendor it. The runtime does not fit this Bun app, and the demo must run with no key. We keep the role split and the paper boundary. Agents are NOVA and NYX (analyst), ORION (bull), VELA (bear), KADE and ZARA (risk).
- The overnight loop in [Shelpid's post](https://x.com/Shelpid_WI3M/status/2116162631308333402) is the product shape: research at night, drop rules that fail the checks, leave a paper book for morning. The 7 AM view is that morning note. We do not ship the prompt.
- [A Symphony by Grok](https://x.com/SimonGFarmer/status/2116193665949606339) is data turned into 13 instrument parts. Each of the 13 rules owns one lane. Only a rule that clears the gate plays. Failed lanes stay on the roll and stay silent. Playback is Web Audio via Tone.js (MIT). A small original Standard MIDI File writer exports `.mid`.
- [The picture-to-three.js post](https://x.com/0x_fokki/status/2116289885870981296) is the reason the war room is a real three.js scene (seated figures, desk, lights) rather than a flat diagram. The geometry is original. No model file is copied.

Price data is a snapshot, not a library. Retrieved 2026-10-31 from the public Yahoo Finance chart endpoint (`range=5y`, `interval=1d`):

- `BTC-USD` daily close
- `ETH-USD` daily close
- `SPY` daily adjusted close (splits and dividends)

Rows are the inner join on UTC dates, 2021-11-01 through 2026-10-30 (SPY sessions only). Stored in `src/data/closes.json` with the citation in the file and on screen. The app does not fetch prices at runtime.

Repo conventions matched to Bot HQ and Talk to the Feed: Bun, `bunfig.toml` with `minimumReleaseAge = 259200`, shadcn/ui (New York, Tailwind v4, Radix), Vite on port 3000, `bun test` and `bun run typecheck`.

## Behaviour

1. **War room.** A dark room (`#0B0F19`, cyan `#3EF0FF`, magenta `#FF2BD6`). Six figures sit around a desk. Speech bubbles advance on a timer from `buildDebate`, a pure function of the backtest. Optional LLM rewrite: `POST /api/debate` reads `NIGHT_DESK_LLM_API_KEY` in the Vite server only. No key, no call, the rules script stays. The key is never written into the client bundle or the repo. `.env.example` is empty.
2. **Backtests.** One card per rule. PASS or FAIL, in-sample and out-of-sample Sharpe (sample std, 252-day, risk-free 0), max drawdown, compounded simulated change, and cost drag. Costs are 10 bps of notional per unit of position change (`0.001 * abs(delta position)`), charged on the next bar's return. Signal at close `t` may use bars `0..t` only and earns the return from `t` to `t+1`.
3. **Split and gate.** Index `floor(0.6 * n)` is the first out-of-sample bar. A rule PASSes only when out-of-sample days ≥ 60, Sharpe ≥ 0.40, max drawdown ≥ −35%, and compounded simulated change > 0, all after costs. The gate is not a forecast and the badge says it is a demo gate.
4. **Paper log.** Position changes become simulated fills at the historical decision close. Sides are BUY, SELL, SHORT, COVER. Each row is labeled a demo fill. No broker field, no network send.
5. **7 AM report.** Equal-weight simulated equity of the rules that cleared the gate, drawn on the out-of-sample window. Thirteen lanes (Violin I and II, Viola, Cello, Contrabass, Flute, Oboe, Clarinet, Bassoon, Horn, Trumpet, Timpani, Piano). Notes exist only on passing lanes, quantized from the last 32 out-of-sample days onto a minor pentatonic. Play uses Tone.js. Export writes a format-1 `.mid`.
6. **Labels.** Every panel shows HISTORICAL DATA, DEMO DATA, or both. A PAPER ONLY disclaimer stays on screen. Copy does not say a rule makes money, beats the market, or will do so later.

Rules (long/flat except mean reversion, which may be short):

| Rule | Asset | Lane |
| --- | --- | --- |
| SMA 20/50 | BTC | Violin I |
| SMA 10/30 | ETH | Violin II |
| SMA 50/200 | SPY | Viola |
| 20-day momentum | BTC | Cello |
| 10-day momentum | ETH | Contrabass |
| 60-day momentum | SPY | Flute |
| 20-day close z-score mean reversion | BTC | Oboe |
| 20-day close z-score mean reversion | ETH | Clarinet |
| 20-day close z-score mean reversion | SPY | Bassoon |
| 20-day Donchian hold | BTC | Horn |
| 15-day Donchian hold | ETH | Trumpet |
| 60-day return > 0 and close > SMA 50 | SPY | Timpani |
| Long BTC only when that SPY dual rule is long | BTC | Piano |

## Files

- `src/data/closes.json` — snapshot and citation. Source of truth for prices.
- `src/lib/backtest.ts` — signals, costs, split, gate, equity. Pure.
- `src/lib/debate.ts` — template lines. Pure.
- `src/lib/fills.ts` — simulated fills. Pure.
- `src/lib/music.ts` and `src/lib/midi.ts` — lanes, notes, SMF bytes. Pure.
- `src/server/llm.ts` — env key check. No client import.
- `src/components/WarRoom.tsx`, `DeskScene.tsx`, `Backtests.tsx`, `PaperLog.tsx`, `MorningReport.tsx`, `PianoRoll.tsx` — views.
- `test/*.test.ts` — metrics fixture, no lookahead, costs, gate, debate, fills, 13 lanes, MIDI header, disclaimer, bookmarks.
- `tracking/seen-bookmarks.json` — keep Bot Brain's bookmark `https://x.com/imryven/status/2115936477171392905` and add the four source posts on the Night Desk pick.

## Verification

From `apps/night-desk`: `bun test`, `bun run typecheck`, then `bun install && bun run dev` and walk the war room, a backtest card, the paper log, and the 7 AM roll in the browser. Screen recording covers the debate bubbles and the piano roll playing.

## Risks

- Yahoo's chart closes are a point-in-time download, not a licensed live feed. The snapshot can disagree with a later adjustment.
- Sharpe with a zero risk-free rate and a 60/40 calendar split is a demo statistic. A PASS is not evidence the rule will keep working.
- Mean-reversion turnover is high, so the 10 bps cost can dominate. That is intended.
- The optional LLM can invent a line the templates would not say. The UI falls back to the rules script on any error, and the on-screen disclaimer still applies.
