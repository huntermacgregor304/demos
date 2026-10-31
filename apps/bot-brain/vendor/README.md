# Vendored projects

Both projects are MIT-licensed. Their license files sit next to the copied sources. Bot Brain does not modify the copied files.

- `karpathy-llm-wiki/` is `scripts/check_evidence.py` from [Astro-Han/karpathy-llm-wiki](https://github.com/Astro-Han/karpathy-llm-wiki). The ingest command runs this script. It is the local, key-free claim sweep.
- `obsidian-skills/` is the `obsidian-markdown` skill from [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills). Wiki notes follow that syntax: properties, wikilinks, and callouts.

[DimitrisLianos/LLM_Wiki_SecondBrain](https://github.com/DimitrisLianos/LLM_Wiki_SecondBrain) is the fully local pipeline from the source list. It needs a local Gemma model, so it is not vendored. The vault layout (raw sources, compiled wiki, wikilinks) follows that pattern.
