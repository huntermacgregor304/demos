import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { llmAdvice } from "@/claims/llm";
import { resolveInputs } from "@/ingest/resolve";
import { buildVault } from "@/wiki/build";

const entry = process.argv[1] ?? "";
if (entry.endsWith("brain.ts") || entry.endsWith("brain.js")) {
  await main();
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(`bot brain

  bun run brain [--bookmarks file] [--knowledge file] [--decisions file]
                [--vault dir] [--port 3000] [--llm] [--ingest-only]

Missing default knowledge and decisions paths fall back to fixtures.
Explicit paths must exist. Inputs are read-only.
`);
    return;
  }

  const inputs = resolveInputs();
  let llmNote: string | null = null;
  if (inputs.llm) {
    const preview = buildVault({
      bookmarksPath: inputs.bookmarks.path,
      knowledgePath: inputs.knowledge.path,
      decisionsPath: inputs.decisions.path,
      vaultDir: inputs.vaultDir,
      origins: {
        bookmarks: inputs.bookmarks.kind,
        knowledge: inputs.knowledge.kind,
        decisions: inputs.decisions.kind,
      },
    });
    llmNote = await llmAdvice(preview.claims);
  }

  const result = buildVault({
    bookmarksPath: inputs.bookmarks.path,
    knowledgePath: inputs.knowledge.path,
    decisionsPath: inputs.decisions.path,
    vaultDir: inputs.vaultDir,
    origins: {
      bookmarks: inputs.bookmarks.kind,
      knowledge: inputs.knowledge.kind,
      decisions: inputs.decisions.kind,
    },
    llmNote,
  });

  const { summary } = result.graph;
  console.log("Bot Brain");
  console.log(`  bookmarks: ${inputs.bookmarks.kind}`);
  console.log(`  knowledge: ${inputs.knowledge.kind}`);
  console.log(`  decisions: ${inputs.decisions.kind}`);
  console.log(`  notes: ${summary.notes}`);
  console.log(`  claims: ${summary.sourced} sourced, ${summary.unverified} unverified`);
  console.log(`  evidence: ${result.evidence.summary} (${result.evidence.engine})`);
  if (result.brokenLinks.length) {
    console.log(`  broken wikilinks: ${result.brokenLinks.length}`);
    for (const link of result.brokenLinks.slice(0, 8)) console.log(`    ${link}`);
  }
  if (inputs.ingestOnly) return;

  const child = spawn(process.execPath, ["vite", "--host", "0.0.0.0", "--port", String(inputs.port), "--strictPort"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    stdio: "inherit",
    env: { ...process.env, BOT_BRAIN_VAULT: inputs.vaultDir },
  });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
}
