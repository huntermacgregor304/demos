# Bot HQ

A visual command center for Hunter's bots. The floor, the handoff tape, the lesson cards, and the missing-bot panel all run on bundled sample data.

No API keys. The app does not call the network.

## Run

```bash
cd apps/bot-hq
bun install
bun run dev
```

Open http://localhost:3000.

## Views

1. **Floor** — interactive space mandala. Earth is a bundled NASA Blue Marble globe (public-domain day, clouds, ocean specular, and night lights) and stands for Hunter. A luminous toroidal thread field spins around it. Each bot is a gold-ringed orb, colored by group. Hover for the job, click for the standing order. A light pulse runs scout → Hunter → Builder → shipped. Clip Editor still reports to YT Master. Tanner, Dude, and Kyle stay a loop. King Jr advises only.

Earth imagery is NASA public-domain Blue Marble, city lights, and cloud maps, stored in `src/assets/earth/`. The page does not fetch them at runtime.
2. **Live handoff** — scout, owner approval, Builder, shipped. Talk to the Feed (Grok Voice 3.0, PR #1) is up and waiting on live keys. Bot HQ is the one being built.
3. **Lessons** — cards parsed from `src/data/knowledge.sample.md`, a sample of the shared knowledge file.
4. **Missing bot** — the roster set against a livestream playbook (planner, builder, critic / QA, ops / monitoring, finance, marketing / social, support, research, scheduler). The open ops seat is the next hire.

`tracking/seen-bookmarks.json` at the repo root lists both picks: Grok Voice 3.0 / Talk to the Feed (`apps/talk-to-the-feed`) and Bot HQ.

## Checks

```bash
bun test
bun run typecheck
```
