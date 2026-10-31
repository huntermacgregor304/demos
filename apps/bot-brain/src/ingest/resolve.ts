import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_KNOWLEDGE = "/home/box/shared/bot-council/KNOWLEDGE.md";
export const DEFAULT_DECISIONS = "/workspace/hud/kb/DECISIONS.md";

export type ResolvedInput = {
  path: string;
  kind: "file" | "fixture";
  label: string;
};

export type ResolvedInputs = {
  bookmarks: ResolvedInput;
  knowledge: ResolvedInput;
  decisions: ResolvedInput;
  vaultDir: string;
  port: number;
  llm: boolean;
  ingestOnly: boolean;
};

export function packageRoot(): string {
  return path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
}

export function fixturePath(name: string): string {
  return path.join(packageRoot(), "fixtures", name);
}

export function resolveInputs(argv = process.argv.slice(2), env = process.env): ResolvedInputs {
  const flags = parseFlags(argv);
  const root = packageRoot();
  return {
    bookmarks: resolveOne(flags.bookmarks, env.BOT_BRAIN_BOOKMARKS, undefined, fixturePath("bookmarks.json"), "bookmarks"),
    knowledge: resolveOne(flags.knowledge, env.BOT_BRAIN_KNOWLEDGE, DEFAULT_KNOWLEDGE, fixturePath("KNOWLEDGE.md"), "knowledge"),
    decisions: resolveOne(flags.decisions, env.BOT_BRAIN_DECISIONS, DEFAULT_DECISIONS, fixturePath("DECISIONS.md"), "decisions"),
    vaultDir: path.resolve(flags.vault || env.BOT_BRAIN_VAULT || path.join(root, "vault")),
    port: Number(flags.port || env.BOT_BRAIN_PORT || 3000),
    llm: flags.llm,
    ingestOnly: flags.ingestOnly,
  };
}

function resolveOne(
  flag: string | undefined,
  envValue: string | undefined,
  fallback: string | undefined,
  fixture: string,
  label: string,
): ResolvedInput {
  if (flag) return mustExist(flag, label);
  if (envValue) return mustExist(envValue, label);
  if (fallback && existsSync(fallback)) return { path: fallback, kind: "file", label };
  return { path: fixture, kind: "fixture", label };
}

function mustExist(file: string, label: string): ResolvedInput {
  const resolved = path.resolve(file);
  if (!existsSync(resolved)) throw new Error(`${label} file not found: ${resolved}`);
  return { path: resolved, kind: "file", label };
}

function parseFlags(argv: string[]) {
  const read = (name: string) => {
    const index = argv.indexOf(name);
    if (index === -1) return undefined;
    return argv[index + 1];
  };
  return {
    bookmarks: read("--bookmarks"),
    knowledge: read("--knowledge"),
    decisions: read("--decisions"),
    vault: read("--vault"),
    port: read("--port"),
    llm: argv.includes("--llm"),
    ingestOnly: argv.includes("--ingest-only"),
  };
}
