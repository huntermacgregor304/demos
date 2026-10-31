# Bot Brain

A local wiki for the bot roster. It ingests sources, links them into an Obsidian vault, claim-checks every statement, and opens a neon graph of the notes.

No API key. The default run does not call the network and does not write to X.

## Run

```bash
cd apps/bot-brain
bun install && bun run brain
```

`bun run dev` is the same command. Open http://localhost:3000.

That one command reads the sources, writes the vault, runs the claim check, and starts the graph.

## What it reuses

The bookmark [10 open-source Claude second brains](https://x.com/imryven/status/2115936477171392905) lists ten repos. The one that runs the whole pipeline on a local model is [DimitrisLianos/LLM_Wiki_SecondBrain](https://github.com/DimitrisLianos/LLM_Wiki_SecondBrain). It needs a Gemma download of about 16 GB, so it cannot be the runtime of `bun run brain`.

The piece that does run fully locally, with no key, is the mechanical evidence checker from [Astro-Han/karpathy-llm-wiki](https://github.com/Astro-Han/karpathy-llm-wiki) (`scripts/check_evidence.py`, MIT). It is vendored and executed on every ingest. Numbers, dates, and quotes in a compiled note must appear in the linked raw file.

Note syntax follows [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) `obsidian-markdown` (MIT), also vendored: YAML properties, `[[wikilinks]]`, and a backlinks section. The vault is `raw/` plus `wiki/`, the same shape as the local LLM wiki.

Ingest of an X bookmarks export, the council knowledge file, and the decisions log is deterministic. None of the ten repos do that without an LLM. NicholasSpisak/second-brain has no license, so it is not included.

## Sources

Inputs are read-only. Flags and env vars:

| Input | Flag | Env | Default |
| --- | --- | --- | --- |
| X bookmarks JSON | `--bookmarks` | `BOT_BRAIN_BOOKMARKS` | `fixtures/bookmarks.json` |
| Council knowledge | `--knowledge` | `BOT_BRAIN_KNOWLEDGE` | `/home/box/shared/bot-council/KNOWLEDGE.md` |
| Decisions log | `--decisions` | `BOT_BRAIN_DECISIONS` | `/workspace/hud/kb/DECISIONS.md` |

If a default path is missing, the matching file in `fixtures/` is used. An explicit flag or env path that is missing is an error. The fixtures are public samples, including an excerpt of the Ryven post. Do not commit a generated `vault/` or any live council file. `vault/` is gitignored.

Accepted bookmark JSON:

- `{ "bookmarks": [ { "id", "url", "text", "author", "author_name", "created_at", "title" } ] }`
- a bare array of those objects
- `window.YTD.bookmark.part0 = [ { "bookmark": { "url" } } ]`

There are no X API calls and no X writes.

## Claim check

A sentence of at least six words is a claim.

- **sourced** when it cites a `[[note]]` or URL whose text contains the claim (shared wording, or every specific literal). The source is written on the claim.
- **unverified** when there is no citation, the cited note does not contain the claim, or a literal such as `42K` is missing from that source.
- An external URL with no captured body counts as sourced and is marked not re-fetched. Bookmark text is captured, so those URLs are checked against the export.

`vendor/karpathy-llm-wiki/scripts/check_evidence.py` then sweeps the compiled notes. The viewer colours notes cyan (sourced), magenta (unverified), or both (mixed).

`--llm` reads `BOT_BRAIN_LLM_API_KEY` or `OPENAI_API_KEY` and may call `BOT_BRAIN_LLM_BASE_URL` (default OpenAI-compatible `/chat/completions`). That note is advisory. The local verdict stays. No key is written into the repo.

## Graph

`src/graph/WikiGraph.tsx` is the MEMORY panel. It takes `nodes`, `edges`, and optional `notes`. Hover a node for its title and claim status. Click to read the note. Scroll zooms, drag pans, and a node can be pulled around. Set `showReader={false}` and use `onSelect` when another panel wants to draw the note.

## Checks

```bash
bun test
bun run typecheck
```
