# Bot Brain plan

There is no in-repo planning skill. `.cursor/skills` is not on `origin/main` (fetched before this note). This is the short plan for `apps/bot-brain`, written before the implementation.

## Overview

Bot Brain ingests three local sources into an Obsidian vault, claim-checks every extracted statement without an API key, and opens a dark neon graph of the notes. One command, `bun run brain`, does all three. Real paths stay read-only. Sample fixtures ship in the repo. The generated vault is gitignored so a run against the live council file cannot be committed.

## What we reuse

The bookmark lists ten Claude second-brain repos. The only one that runs the whole pipeline on a local model is [DimitrisLianos/LLM_Wiki_SecondBrain](https://github.com/DimitrisLianos/LLM_Wiki_SecondBrain) (MIT). Its ingest calls Gemma (about 16 GB) and does not run in this Bun app.

The best-fitting local piece we can actually execute here is the mechanical evidence checker from [Astro-Han/karpathy-llm-wiki](https://github.com/Astro-Han/karpathy-llm-wiki) (`scripts/check_evidence.py`, MIT). It flags numbers, dates, and quotes that are not in the linked raw file, with no network and no key. We vendor that script and run it on every ingest.

Note shape follows [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) `obsidian-markdown` (MIT): YAML properties, `[[wikilinks]]`, and a backlinks section. That skill is vendored under `vendor/obsidian-skills`. NicholasSpisak/second-brain has no license, so it is not vendored.

Deterministic ingest of an X bookmarks JSON export, the council knowledge file, and the decisions log is new. None of the ten repos do that without an LLM.

## Behaviour

1. Read bookmarks, knowledge, and decisions. Defaults: `BOT_BRAIN_BOOKMARKS`, `/home/box/shared/bot-council/KNOWLEDGE.md`, `/workspace/hud/kb/DECISIONS.md`. Missing defaults fall back to `fixtures/`. Flags that point at a missing file fail. Inputs are never written.
2. Write `raw/` plus `wiki/` notes with frontmatter, wikilinks, and backlinks. Heading sections become their own notes.
3. A claim is sourced only when it cites a note or URL that supports it (overlap, or a specific literal found in that source). Otherwise it is unverified. The vendored checker then sweeps compiled notes for literals missing from raw. No API key. `--llm` may read `BOT_BRAIN_LLM_API_KEY` or `OPENAI_API_KEY` and attach an advisory verdict. It never replaces the local status.
4. `WikiGraph` draws notes as glowing nodes and wikilinks as edges. Colour is claim status: cyan sourced, magenta unverified, both when mixed. Hover and click open the note. The component takes `nodes`, `edges`, and optional `notes` so a later HUD MEMORY panel can mount it.
5. `bun run brain` and `bun run dev` ingest, claim-check, and start the viewer.

## Risks

- A live knowledge file can be large. The compiler is heading-and-sentence based, not an LLM summary.
- External URLs are not fetched. A URL citation with no local capture counts as sourced and is labeled as not re-fetched.
- Linux filenames are case-sensitive. Wikilink targets match note titles exactly.
